"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import SaveOverlay from "@/components/SaveOverlay";
import Spinner from "@/components/Spinner";
import InactivityGuard from "@/components/InactivityGuard";
import SignaturePad from "@/components/SignaturePad";
import FlatpickrInput from "@/components/FlatpickrInput";
import { compressImage } from "@/lib/imageCompress";
import {
  HandoverDoc,
  defaultHandover,
  normalizeHandover,
  handoverImageUrl,
  uid,
  Building,
  PunchItem,
  AssetItem,
  DocItem,
  AcceptItem,
  DetailImage,
} from "@/lib/handoverTypes";

interface Props {
  session: { name: string; role: "admin" | "user" };
}

// ---- Single-image uploader: compress in the browser, upload one per request --
function ImageUpload({
  fileId,
  onChange,
  hint,
  tall,
}: {
  fileId: string;
  onChange: (id: string) => void;
  hint?: string;
  tall?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const { file: compressed, error } = await compressImage(file);
      if (error) {
        setErr(error);
        setBusy(false);
        return;
      }
      const fd = new FormData();
      fd.append("file", compressed);
      const res = await fetch("/api/handover/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
      onChange(data.fileId);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        onClick={() => !busy && inputRef.current?.click()}
        className={
          "relative border-2 border-dashed border-gray-300 rounded-xl overflow-hidden cursor-pointer hover:border-brand-red transition-colors bg-gray-50 flex items-center justify-center " +
          (tall ? "h-56" : "h-40")
        }
      >
        {fileId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={handoverImageUrl(fileId)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-2">
            <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs text-gray-400">{hint || "คลิกเพื่ออัปโหลดรูป"}</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="h-7 w-7 border-gray-200 border-t-brand-red rounded-full" style={{ animation: "spin 0.7s linear infinite", borderWidth: "3px" }} />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <div className="flex items-center justify-between mt-1.5">
        {err ? <span className="text-xs text-red-500">{err}</span> : <span />}
        {fileId && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-gray-400 hover:text-brand-red">
            ลบรูป
          </button>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {desc && <p className="text-sm text-gray-500 mt-0.5 mb-4">{desc}</p>}
      {!desc && <div className="mb-4" />}
      {children}
    </div>
  );
}

const iconBtn = "text-gray-400 hover:text-red-500 transition-colors";

export default function HandoverEditClient({ session }: Props) {
  const [doc, setDoc] = useState<HandoverDoc>(() => defaultHandover("", ""));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  // Load existing document when ?id= is present.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;
    setLoading(true);
    fetch("/api/handover")
      .then((r) => r.json())
      .then((list: HandoverDoc[]) => {
        const found = Array.isArray(list) ? list.find((d) => d.id === id) : null;
        if (found) {
          setDoc(normalizeHandover(found));
          setSavedOnce(true);
        } else {
          alert("ไม่พบเอกสาร");
          window.location.href = "/admin/handover";
        }
      })
      .catch(() => alert("โหลดเอกสารไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  // Update share link whenever the doc gains an id+token.
  useEffect(() => {
    if (doc.id && doc.shareToken) {
      setShareLink(window.location.origin + "/handover/" + doc.id + "?token=" + doc.shareToken);
    }
  }, [doc.id, doc.shareToken]);

  const set = <K extends keyof HandoverDoc>(key: K, val: HandoverDoc[K]) =>
    setDoc((p) => ({ ...p, [key]: val }));

  // ---- Scopes -----------------------------------------------------------------
  const setScopeStatus = (i: number, status: "completed" | "pending") =>
    setDoc((p) => ({ ...p, scopes: p.scopes.map((s, idx) => (idx === i ? { ...s, status } : s)) }));
  const setScopeLabel = (i: number, label: string) =>
    setDoc((p) => ({ ...p, scopes: p.scopes.map((s, idx) => (idx === i ? { ...s, label } : s)) }));

  // ---- Buildings --------------------------------------------------------------
  const addBuilding = () =>
    setDoc((p) => ({
      ...p,
      buildings: [
        ...p.buildings,
        { id: uid("b_"), name: "", imageFileId: "", scopes: [{ label: "โครงสร้าง", done: true }], status: "completed", note: "" },
      ],
    }));
  const updateBuilding = (id: string, patch: Partial<Building>) =>
    setDoc((p) => ({ ...p, buildings: p.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  const removeBuilding = (id: string) =>
    setDoc((p) => ({ ...p, buildings: p.buildings.filter((b) => b.id !== id) }));
  const addBuildingScope = (id: string) =>
    setDoc((p) => ({
      ...p,
      buildings: p.buildings.map((b) => (b.id === id ? { ...b, scopes: [...b.scopes, { label: "", done: true }] } : b)),
    }));
  const updateBuildingScope = (bid: string, i: number, patch: Partial<{ label: string; done: boolean }>) =>
    setDoc((p) => ({
      ...p,
      buildings: p.buildings.map((b) =>
        b.id === bid ? { ...b, scopes: b.scopes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } : b
      ),
    }));
  const removeBuildingScope = (bid: string, i: number) =>
    setDoc((p) => ({
      ...p,
      buildings: p.buildings.map((b) => (b.id === bid ? { ...b, scopes: b.scopes.filter((_, idx) => idx !== i) } : b)),
    }));

  // ---- Detail images ----------------------------------------------------------
  const addDetailImage = () =>
    setDoc((p) => ({ ...p, detailImages: [...p.detailImages, { id: uid("di_"), fileId: "", caption: "" }] }));
  const updateDetailImage = (id: string, patch: Partial<DetailImage>) =>
    setDoc((p) => ({ ...p, detailImages: p.detailImages.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const removeDetailImage = (id: string) =>
    setDoc((p) => ({ ...p, detailImages: p.detailImages.filter((d) => d.id !== id) }));

  // ---- Documents --------------------------------------------------------------
  const updateDocItem = (id: string, patch: Partial<DocItem>) =>
    setDoc((p) => ({ ...p, documents: p.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const addDocItem = () =>
    setDoc((p) => ({ ...p, documents: [...p.documents, { id: uid("d_"), label: "", included: true }] }));
  const removeDocItem = (id: string) =>
    setDoc((p) => ({ ...p, documents: p.documents.filter((d) => d.id !== id) }));

  // ---- Punch list -------------------------------------------------------------
  const addPunch = () =>
    setDoc((p) => ({
      ...p,
      punchList: [...p.punchList, { id: uid("p_"), location: "", description: "", fixDate: "", status: "pending" }],
    }));
  const updatePunch = (id: string, patch: Partial<PunchItem>) =>
    setDoc((p) => ({ ...p, punchList: p.punchList.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const removePunch = (id: string) =>
    setDoc((p) => ({ ...p, punchList: p.punchList.filter((x) => x.id !== id) }));

  // ---- Assets -----------------------------------------------------------------
  const addAsset = () =>
    setDoc((p) => ({ ...p, assets: [...p.assets, { id: uid("a_"), item: "", qty: "", note: "" }] }));
  const updateAsset = (id: string, patch: Partial<AssetItem>) =>
    setDoc((p) => ({ ...p, assets: p.assets.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const removeAsset = (id: string) =>
    setDoc((p) => ({ ...p, assets: p.assets.filter((x) => x.id !== id) }));

  // ---- Acceptance items -------------------------------------------------------
  const addAccept = () =>
    setDoc((p) => ({ ...p, acceptItems: [...p.acceptItems, { id: uid("ac_"), label: "" }] }));
  const updateAccept = (id: string, patch: Partial<AcceptItem>) =>
    setDoc((p) => ({ ...p, acceptItems: p.acceptItems.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const removeAccept = (id: string) =>
    setDoc((p) => ({ ...p, acceptItems: p.acceptItems.filter((x) => x.id !== id) }));

  // ---- Save -------------------------------------------------------------------
  const handleSave = async () => {
    if (!doc.projectName.trim()) {
      alert("กรุณากรอกชื่อโครงการก่อนบันทึก");
      return;
    }
    setSaving(true);
    try {
      const isNew = !savedOnce || !doc.id;
      const res = await fetch("/api/handover", {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");

      if (isNew && data.id) {
        setDoc((p) => ({ ...p, id: data.id, shareToken: data.shareToken }));
        // Reflect the new id in the URL without a reload.
        window.history.replaceState(null, "", "/admin/handover/edit?id=" + data.id);
      }
      setSavedOnce(true);
      alert("บันทึกเรียบร้อยแล้ว");
    } catch (err) {
      alert("บันทึกไม่สำเร็จ: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("คัดลอกลิงก์นี้:", shareLink);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar session={session} />
        <div className="py-20">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <Navbar session={session} />
      <InactivityGuard />
      {saving && <SaveOverlay message="กำลังบันทึก..." />}

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="slide-up">
          <a href="/admin/handover" className="text-sm text-gray-500 hover:text-brand-red">← กลับรายการเอกสาร</a>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {savedOnce ? "แก้ไขเอกสารส่งมอบงาน" : "สร้างเอกสารส่งมอบงาน"}
          </h1>
          <p className="text-gray-500 mt-1">กรอกข้อมูล + อัปโหลดรูป แล้วส่งลิงก์ให้ลูกค้าตรวจรับ</p>
        </div>

        {savedOnce && shareLink && (
          <div className="card bg-brand-light border-brand-red/20">
            <p className="text-sm font-semibold text-brand-red mb-2">ลิงก์สำหรับลูกค้า</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input readOnly value={shareLink} className="input-field text-sm flex-1" onClick={(e) => e.currentTarget.select()} />
              <button onClick={copyLink} className="btn-secondary whitespace-nowrap text-sm">
                {copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์"}
              </button>
              <a href={shareLink} target="_blank" rel="noopener noreferrer" className="btn-primary whitespace-nowrap text-sm text-center">
                เปิดเอกสาร
              </a>
            </div>
          </div>
        )}

        {/* 1. Project info */}
        <SectionCard title="1. ข้อมูลโครงการ">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">ชื่อโครงการ <span className="text-red-500">*</span></label>
              <input value={doc.projectName} onChange={(e) => set("projectName", e.target.value)} className="input-field" placeholder="เช่น บ้านคุณสมชาย" />
            </div>
            <div>
              <label className="label">รหัสโครงการ</label>
              <input value={doc.projectCode} onChange={(e) => set("projectCode", e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">สถานที่ก่อสร้าง</label>
              <input value={doc.location} onChange={(e) => set("location", e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">เจ้าของโครงการ</label>
              <input value={doc.owner} onChange={(e) => set("owner", e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">ผู้รับเหมา</label>
              <input value={doc.contractor} onChange={(e) => set("contractor", e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="label">วันที่เริ่มต้น</label>
              <FlatpickrInput value={doc.startDate} onChange={(v) => set("startDate", v)} placeholder="เลือกวันที่" />
            </div>
            <div>
              <label className="label">วันที่แล้วเสร็จ</label>
              <FlatpickrInput value={doc.endDate} onChange={(v) => set("endDate", v)} placeholder="เลือกวันที่" />
            </div>
          </div>
        </SectionCard>

        {/* 2. Scope / completion */}
        <SectionCard title="2. สถานะความสำเร็จของงาน" desc="ขอบเขตงานหลักและสถานะ (แสดงในหน้า Completion Status)">
          <div className="space-y-2">
            {doc.scopes.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <input value={s.label} onChange={(e) => setScopeLabel(i, e.target.value)} className="input-field flex-1" />
                <select value={s.status} onChange={(e) => setScopeStatus(i, e.target.value as "completed" | "pending")} className="input-field w-36">
                  <option value="completed">เสร็จแล้ว</option>
                  <option value="pending">ค้าง</option>
                </select>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 3. Site overview */}
        <SectionCard title="3. ผังโครงการ (Site Overview)" desc="รูปผังรวม/ภาพมุมสูง และรายการอาคาร">
          <label className="label">รูปผังรวม / ภาพมุมสูง</label>
          <ImageUpload fileId={doc.siteImageFileId} onChange={(id) => set("siteImageFileId", id)} hint="อัปโหลดภาพผังโครงการ" tall />

          <div className="mt-6 space-y-4">
            <label className="label">อาคารในโครงการ</label>
            {doc.buildings.map((b, bi) => (
              <div key={b.id} className="border border-gray-200 rounded-xl p-4 relative">
                <button type="button" onClick={() => removeBuilding(b.id)} className={"absolute top-3 right-3 " + iconBtn}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h4 className="text-sm font-semibold text-gray-500 mb-3">อาคารที่ {bi + 1}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">ชื่ออาคาร</label>
                    <input value={b.name} onChange={(e) => updateBuilding(b.id, { name: e.target.value })} className="input-field" placeholder="เช่น อาคารหลัก" />
                    <label className="label mt-3">สถานะ</label>
                    <select value={b.status} onChange={(e) => updateBuilding(b.id, { status: e.target.value })} className="input-field">
                      <option value="completed">เสร็จแล้ว</option>
                      <option value="pending">กำลังดำเนินการ</option>
                    </select>
                    <label className="label mt-3">หมายเหตุ (เช่น จำนวนห้อง)</label>
                    <input value={b.note} onChange={(e) => updateBuilding(b.id, { note: e.target.value })} className="input-field" placeholder="เช่น 4 ห้องนอน 3 ห้องน้ำ" />
                  </div>
                  <div>
                    <label className="label">รูปอาคาร</label>
                    <ImageUpload fileId={b.imageFileId} onChange={(id) => updateBuilding(b.id, { imageFileId: id })} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label">รายการงานในอาคาร</label>
                  <div className="space-y-2">
                    {b.scopes.map((s, si) => (
                      <div key={si} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={s.done}
                          onChange={(e) => updateBuildingScope(b.id, si, { done: e.target.checked })}
                          className="w-4 h-4 accent-brand-red"
                        />
                        <input value={s.label} onChange={(e) => updateBuildingScope(b.id, si, { label: e.target.value })} className="input-field flex-1" placeholder="เช่น งานระบบ" />
                        <button type="button" onClick={() => removeBuildingScope(b.id, si)} className={iconBtn}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addBuildingScope(b.id)} className="text-xs text-brand-red mt-2 hover:underline">+ เพิ่มรายการงาน</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addBuilding} className="btn-secondary w-full">+ เพิ่มอาคาร</button>
          </div>
        </SectionCard>

        {/* 4. Detail & finish gallery */}
        <SectionCard title="4. รายละเอียดและงานเก็บ (Detail & Finish)" desc="อัปโหลดรูปประกอบในแต่ละจุด พร้อมคำบรรยาย">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {doc.detailImages.map((d) => (
              <div key={d.id} className="border border-gray-200 rounded-xl p-3">
                <ImageUpload fileId={d.fileId} onChange={(id) => updateDetailImage(d.id, { fileId: id })} />
                <input value={d.caption} onChange={(e) => updateDetailImage(d.id, { caption: e.target.value })} className="input-field mt-2 text-sm" placeholder="คำบรรยายรูป" />
                <button type="button" onClick={() => removeDetailImage(d.id)} className="text-xs text-gray-400 hover:text-red-500 mt-2">ลบรูปนี้</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addDetailImage} className="btn-secondary w-full mt-4">+ เพิ่มรูป</button>
        </SectionCard>

        {/* 5. Documents */}
        <SectionCard title="5. เอกสารที่ส่งมอบ" desc="ติ๊กรายการที่ส่งมอบให้ลูกค้า">
          <div className="space-y-2">
            {doc.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <input type="checkbox" checked={d.included} onChange={(e) => updateDocItem(d.id, { included: e.target.checked })} className="w-4 h-4 accent-brand-red" />
                <input value={d.label} onChange={(e) => updateDocItem(d.id, { label: e.target.value })} className="input-field flex-1" />
                <button type="button" onClick={() => removeDocItem(d.id)} className={iconBtn}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addDocItem} className="text-xs text-brand-red mt-2 hover:underline">+ เพิ่มรายการเอกสาร</button>
        </SectionCard>

        {/* 6. Punch list */}
        <SectionCard title="6. งานคงค้าง (Punch List)" desc="รายการที่ต้องแก้ไข">
          <div className="space-y-3">
            {doc.punchList.map((x, i) => (
              <div key={x.id} className="border border-gray-200 rounded-xl p-3 relative">
                <button type="button" onClick={() => removePunch(x.id)} className={"absolute top-3 right-3 " + iconBtn}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h4 className="text-xs font-semibold text-gray-500 mb-2">รายการที่ {i + 1}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={x.location} onChange={(e) => updatePunch(x.id, { location: e.target.value })} className="input-field" placeholder="ตำแหน่ง เช่น อาคารหลัก" />
                  <div className="flex gap-2">
                    <FlatpickrInput value={x.fixDate} onChange={(v) => updatePunch(x.id, { fixDate: v })} placeholder="กำหนดแก้ไข" />
                    <select value={x.status} onChange={(e) => updatePunch(x.id, { status: e.target.value as "pending" | "fixed" })} className="input-field w-32">
                      <option value="pending">ค้าง</option>
                      <option value="fixed">แก้แล้ว</option>
                    </select>
                  </div>
                  <input value={x.description} onChange={(e) => updatePunch(x.id, { description: e.target.value })} className="input-field sm:col-span-2" placeholder="รายละเอียดงานที่ต้องแก้" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addPunch} className="btn-secondary w-full mt-3">+ เพิ่มงานคงค้าง</button>
        </SectionCard>

        {/* 7. Warranty */}
        <SectionCard title="7. การรับประกัน (Warranty)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">ระยะเวลา (เดือน)</label>
              <input value={doc.warrantyMonths} onChange={(e) => set("warrantyMonths", e.target.value)} className="input-field" placeholder="12" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">หมายเหตุการรับประกัน</label>
              <input value={doc.warrantyNote} onChange={(e) => set("warrantyNote", e.target.value)} className="input-field" />
            </div>
          </div>
        </SectionCard>

        {/* 8. Assets / keys */}
        <SectionCard title="8. การส่งมอบทรัพย์สิน / กุญแจ">
          <div className="space-y-2">
            {doc.assets.map((x) => (
              <div key={x.id} className="flex gap-2">
                <input value={x.item} onChange={(e) => updateAsset(x.id, { item: e.target.value })} className="input-field flex-1" placeholder="รายการ" />
                <input value={x.qty} onChange={(e) => updateAsset(x.id, { qty: e.target.value })} className="input-field w-24" placeholder="จำนวน" />
                <input value={x.note} onChange={(e) => updateAsset(x.id, { note: e.target.value })} className="input-field flex-1" placeholder="หมายเหตุ" />
                <button type="button" onClick={() => removeAsset(x.id)} className={iconBtn}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAsset} className="text-xs text-brand-red mt-2 hover:underline">+ เพิ่มรายการ</button>
        </SectionCard>

        {/* 9. Acceptance checklist */}
        <SectionCard title="9. รายการให้ลูกค้าตรวจรับ" desc="ลูกค้าจะติ๊กแต่ละข้อในลิงก์ตรวจรับ">
          <div className="space-y-2">
            {doc.acceptItems.map((x, i) => (
              <div key={x.id} className="flex items-center gap-2">
                <span className="w-6 h-6 bg-brand-light text-brand-red rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                <input value={x.label} onChange={(e) => updateAccept(x.id, { label: e.target.value })} className="input-field flex-1" />
                <button type="button" onClick={() => removeAccept(x.id)} className={iconBtn}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addAccept} className="text-xs text-brand-red mt-2 hover:underline">+ เพิ่มรายการตรวจรับ</button>
        </SectionCard>

        {/* 10. Contractor signature */}
        <SectionCard title="10. ผู้ส่งมอบ (ผู้รับเหมา)" desc="ลายเซ็นฝั่งบริษัท (ลูกค้าจะเซ็นในลิงก์ตรวจรับ)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">ชื่อผู้ส่งมอบ</label>
              <input value={doc.contractorSignName} onChange={(e) => set("contractorSignName", e.target.value)} className="input-field" />
              <label className="label mt-3">วันที่</label>
              <FlatpickrInput value={doc.contractorSignDate} onChange={(v) => set("contractorSignDate", v)} placeholder="เลือกวันที่" />
            </div>
            <SignaturePad value={doc.contractorSignature} onChange={(v) => set("contractorSignature", v)} label="ลายเซ็น" />
          </div>
        </SectionCard>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <a href="/admin/handover" className="btn-ghost text-sm">ยกเลิก</a>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "กำลังบันทึก..." : savedOnce ? "บันทึกการแก้ไข" : "บันทึกเอกสาร"}
          </button>
        </div>
      </div>
    </div>
  );
}
