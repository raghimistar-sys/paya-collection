import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import {
  LayoutDashboard, ListChecks, Receipt, Handshake, CalendarClock, Trophy,
  Users2, Shuffle, UploadCloud, Settings as SettingsIcon, LogOut, Search,
  PhoneCall, CheckCircle2, XCircle, AlertTriangle, Clock, Filter, X, Plus,
  FileSpreadsheet, Menu, ChevronDown, Trash2, Pencil, RefreshCw, Info,
  BadgeCheck, CalendarDays, Coins, UserCog, Building2, ArrowUpRight,
  Inbox, History, ShieldAlert, CircleDot,
} from "lucide-react";

/* ============================================================
   CONSTANTS
   ============================================================ */

const STORAGE_KEY = "debt-collect-app-state-v1";

const DEFAULT_PROVIDER_MAP = { 6: "بلوبانک", 9: "های‌بانک", 10: "بلوفای", 12: "بلوفای" };

const ROLE_LABEL = { admin: "ادمین", supervisor: "سرپرست", agent: "کارشناس" };
const STATUS_LABEL = { active: "فعال", inactive: "غیرفعال" };

const CALL_RESULTS = [
  "پاسخگو نبود", "خاموش بود", "در دسترس نبود", "شماره اشتباه است",
  "شماره واگذار شده", "پاسخ داد", "اعلام کرد پرداخت کرده", "تعهد به پرداخت داد",
  "توانایی پرداخت ندارد", "امتناع از پرداخت", "نیاز به پیگیری مجدد", "سایر",
];

const POSITIVE_RESULTS = ["پاسخ داد", "تعهد به پرداخت داد", "اعلام کرد پرداخت کرده"];

const APP_FIELDS = [
  { key: "installment_id", label: "شناسه قسط (کلید یکتا)" },
  { key: "loan_id", label: "شناسه وام (Loan ID)" },
  { key: "user_id", label: "شناسه کاربر" },
  { key: "customer_name", label: "نام مشتری" },
  { key: "mobile", label: "موبایل" },
  { key: "essential_phone", label: "شماره ضروری" },
  { key: "national_code", label: "کد ملی" },
  { key: "state_id", label: "شناسه استان/شهر" },
  { key: "state_name", label: "استان/شهر" },
  { key: "installment_number", label: "شماره قسط" },
  { key: "raw_amount", label: "مبلغ خام" },
  { key: "amount_excl_tax", label: "مبلغ بدون مالیات" },
  { key: "amount_incl_tax", label: "مبلغ با مالیات" },
  { key: "late_fee_excl_tax", label: "جریمه بدون مالیات" },
  { key: "late_fee_incl_tax", label: "جریمه با مالیات" },
  { key: "payable_amount", label: "مبلغ قابل پرداخت" },
  { key: "partner_paid_amount", label: "مبلغ پرداخت‌شده پارتنر (اختیاری/آتی)" },
  { key: "partner_unpaid_amount", label: "مبلغ پرداخت‌نشده پارتنر (اختیاری/آتی)" },
  { key: "partner_status", label: "وضعیت پارتنر (اختیاری/آتی)" },
  { key: "due_date", label: "تاریخ سررسید" },
  { key: "status", label: "وضعیت پرداخت (۰ = پرداخت‌نشده)" },
  { key: "paid_at", label: "تاریخ پرداخت" },
  { key: "provider_id", label: "شناسه پروایدر" },
  { key: "provider_name", label: "نام پروایدر (اختیاری)" },
  { key: "__ignore__", label: "— نادیده گرفته شود —" },
];

// Auto-guess mapping for common column names, incl. the real schema aliases
// (loan_installments.*, Users__name, Users__national_code, Users__mobile, ...)
const HEADER_GUESS = {
  "id": "installment_id",
  "installment id": "installment_id",
  "loan id": "loan_id",
  "user id": "user_id",
  "number": "installment_number",
  "installment number": "installment_number",
  "raw amount": "raw_amount",
  "amount excl tax": "amount_excl_tax",
  "amount incl tax": "amount_incl_tax",
  "late fee excl tax": "late_fee_excl_tax",
  "late fee incl tax": "late_fee_incl_tax",
  "payable amount": "payable_amount",
  "partner paid amount": "partner_paid_amount",
  "partner unpaid amount": "partner_unpaid_amount",
  "partner status": "partner_status",
  "due date": "due_date",
  "status": "status",
  "paid at": "paid_at",
  "provider id": "provider_id",
  "provider name": "provider_name",

  "users name": "customer_name",
  "name": "customer_name",
  "customer name": "customer_name",

  "users national code": "national_code",
  "national code": "national_code",
  "کد ملی": "national_code",

  "users mobile": "mobile",
  "mobile": "mobile",
  "phone": "mobile",
  "شماره موبایل": "mobile",
  "موبایل": "mobile",

  "users essential phone": "essential_phone",
  "essential phone": "essential_phone",
  "emergency phone": "essential_phone",
  "شماره ضروری": "essential_phone",

  "users state id": "state_id",
  "states id": "state_id",
  "state id": "state_id",

  "states name": "state_name",
  "state name": "state_name",
  "province": "state_name",
  "province name": "state_name",
  "city": "state_name",
  "city name": "state_name",
  "استان": "state_name",
  "شهر": "state_name",
};

function normalizeHeader(header) {
  return String(header || "")
    .replace(/â†’/g, " ")
    .replace(/→/g, " ")
    .replace(/[_\.\-\/\()\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function guessField(header) {
  const norm = normalizeHeader(header);
  if (HEADER_GUESS[norm]) return HEADER_GUESS[norm];

  // Flexible matching for exports whose aliases contain prefixes/suffixes.
  if (norm.includes("essential phone")) return "essential_phone";
  if (norm.includes("national code")) return "national_code";
  if (norm.includes("states") && norm.endsWith("name")) return "state_name";
  if (norm.includes("state") && norm.endsWith("id")) return "state_id";
  if (norm.includes("users") && norm.endsWith("mobile")) return "mobile";
  if (norm.includes("users") && norm.endsWith("name")) return "customer_name";
  if (norm.includes("partner paid amount")) return "partner_paid_amount";
  if (norm.includes("partner unpaid amount")) return "partner_unpaid_amount";
  if (norm.includes("partner status")) return "partner_status";
  return "__ignore__";
}

/* ============================================================
   UTILITIES
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
const nowIso = () => new Date().toISOString();
const todayISO = () => new Date().toISOString().slice(0, 10);

function toDateOnly(v) {
  if (!v && v !== 0) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function daysOverdue(dueDate) {
  const d = toDateOnly(dueDate);
  if (!d) return null;
  const diff = Math.round((new Date(todayISO()).getTime() - new Date(d).getTime()) / 86400000);
  return diff;
}

function fmtNum(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return new Intl.NumberFormat("fa-IR").format(num);
}

function fmtJalali(v) {
  const d = toDateOnly(v);
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
  } catch (e) {
    return d;
  }
}

function fmtJalaliDateTime(v) {
  if (!v) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
  } catch (e) {
    return v;
  }
}

const isUnpaid = (status) => String(status) === "0";

/* ============================================================
   BUSINESS LOGIC
   ============================================================ */

function matchKey(rec) {
  const hasBusinessKey = rec.national_code && rec.loan_id !== undefined && rec.loan_id !== null && rec.loan_id !== "" && rec.installment_number !== undefined && rec.installment_number !== null && rec.installment_number !== "";
  if (hasBusinessKey) {
    return "nk:" + [rec.national_code, rec.loan_id, rec.installment_number].join("|");
  }
  if (rec.installment_id !== undefined && rec.installment_id !== null && rec.installment_id !== "") {
    return "id:" + rec.installment_id;
  }
  return null;
}

function applyMapping(row, mapping) {
  const out = {};
  Object.entries(mapping).forEach(([csvCol, appField]) => {
    if (!appField || appField === "__ignore__") return;
    let val = row[csvCol];
    if (val === undefined) return;
    if (typeof val === "string") val = val.trim();
    out[appField] = val === "" ? null : val;
  });
  if (out.due_date) out.due_date = toDateOnly(out.due_date);
  if (out.paid_at) out.paid_at = toDateOnly(out.paid_at);
  if (out.provider_id !== undefined && out.provider_id !== null && out.provider_id !== "") {
    const n = Number(out.provider_id);
    out.provider_id = isNaN(n) ? out.provider_id : n;
  }
  return out;
}

function runImport(existingInstallments, csvRows, mapping, providerMap) {
  const list = existingInstallments.map((r) => ({ ...r }));
  const idx = new Map(list.map((r, i) => [matchKey(r), i]));
  let inserted = 0, updated = 0, errors = 0;
  const paymentEvents = [];
  const stamp = nowIso();

  csvRows.forEach((row) => {
    try {
      const mapped = applyMapping(row, mapping);
      const hasId = mapped.installment_id !== undefined && mapped.installment_id !== null && mapped.installment_id !== "";
      const hasBusinessKey = mapped.national_code && mapped.loan_id !== undefined && mapped.loan_id !== null && mapped.loan_id !== "" && mapped.installment_number !== undefined && mapped.installment_number !== null && mapped.installment_number !== "";
      if (!hasBusinessKey && !hasId) { errors++; return; }

      const key = matchKey(mapped);
      if (!key) { errors++; return; }
      const i = idx.get(key);

      if (i === undefined) {
        const rec = {
          recordId: uid(),
          installment_id: mapped.installment_id ?? null,
          loan_id: mapped.loan_id ?? null,
          user_id: mapped.user_id ?? null,
          customer_name: mapped.customer_name ?? null,
          mobile: mapped.mobile ?? null,
          essential_phone: mapped.essential_phone ?? null,
          national_code: mapped.national_code ?? null,
          state_id: mapped.state_id ?? null,
          state_name: mapped.state_name ?? null,
          installment_number: mapped.installment_number ?? null,
          raw_amount: mapped.raw_amount ?? null,
          amount_excl_tax: mapped.amount_excl_tax ?? null,
          amount_incl_tax: mapped.amount_incl_tax ?? null,
          late_fee_excl_tax: mapped.late_fee_excl_tax ?? null,
          late_fee_incl_tax: mapped.late_fee_incl_tax ?? null,
          payable_amount: mapped.payable_amount ?? null,
          partner_paid_amount: mapped.partner_paid_amount ?? null,
          partner_unpaid_amount: mapped.partner_unpaid_amount ?? null,
          partner_status: mapped.partner_status ?? null,
          due_date: mapped.due_date ?? null,
          status: mapped.status ?? null,
          paid_at: mapped.paid_at ?? null,
          provider_id: mapped.provider_id ?? null,
          provider_name: providerMap[mapped.provider_id] || mapped.provider_name || "نامشخص",
          assigned_agent_id: null,
          next_follow_up_date: null,
          last_contact_at: null,
          last_call_result: null,
          call_count: 0,
          active_promise_id: null,
          created_at: stamp,
          updated_at: stamp,
        };
        list.push(rec);
        idx.set(key, list.length - 1);
        inserted++;
      } else {
        const existing = list[i];
        const wasUnpaid = isUnpaid(existing.status);
        const paidAtNewlyFilled = !existing.paid_at && !!mapped.paid_at;
        const statusMovedFromZero = wasUnpaid && mapped.status !== undefined && mapped.status !== null && !isUnpaid(mapped.status);
        const willBePaid = wasUnpaid && (statusMovedFromZero || paidAtNewlyFilled);

        const merged = {
          ...existing,
          raw_amount: mapped.raw_amount ?? existing.raw_amount,
          amount_excl_tax: mapped.amount_excl_tax ?? existing.amount_excl_tax,
          amount_incl_tax: mapped.amount_incl_tax ?? existing.amount_incl_tax,
          late_fee_excl_tax: mapped.late_fee_excl_tax ?? existing.late_fee_excl_tax,
          late_fee_incl_tax: mapped.late_fee_incl_tax ?? existing.late_fee_incl_tax,
          payable_amount: mapped.payable_amount ?? existing.payable_amount,
          partner_paid_amount: mapped.partner_paid_amount ?? existing.partner_paid_amount,
          partner_unpaid_amount: mapped.partner_unpaid_amount ?? existing.partner_unpaid_amount,
          partner_status: mapped.partner_status ?? existing.partner_status,
          due_date: mapped.due_date ?? existing.due_date,
          status: (mapped.status !== undefined && mapped.status !== null) ? mapped.status : existing.status,
          paid_at: mapped.paid_at ?? existing.paid_at,
          provider_id: (mapped.provider_id ?? existing.provider_id),
          provider_name: providerMap[mapped.provider_id ?? existing.provider_id] || existing.provider_name,
          customer_name: mapped.customer_name || existing.customer_name,
          mobile: mapped.mobile || existing.mobile,
          essential_phone: mapped.essential_phone || existing.essential_phone,
          national_code: mapped.national_code || existing.national_code,
          state_id: mapped.state_id ?? existing.state_id,
          state_name: mapped.state_name || existing.state_name,
          updated_at: stamp,
        };
        list[i] = merged;
        updated++;
        if (willBePaid) paymentEvents.push({ ...merged });
      }
    } catch (e) {
      errors++;
    }
  });

  return { list, inserted, updated, errors, paymentEvents, totalRows: csvRows.length };
}

function buildPayments(paymentEvents) {
  const payments = [];
  const attributions = [];
  paymentEvents.forEach((ev) => {
    const paymentId = uid();
    const amount = Number(ev.payable_amount ?? ev.amount_incl_tax ?? ev.raw_amount ?? 0) || 0;
    payments.push({
      id: paymentId,
      installment_record_id: ev.recordId,
      amount,
      payment_date: ev.paid_at || todayISO(),
      detected_at: nowIso(),
      created_at: nowIso(),
    });
    if (ev.assigned_agent_id) {
      attributions.push({
        id: uid(),
        payment_id: paymentId,
        installment_record_id: ev.recordId,
        agent_id: ev.assigned_agent_id,
        attribution_type: "Owner Credit",
        attributed_amount: amount,
        created_at: nowIso(),
      });
    }
  });
  return { payments, attributions };
}

function reconcilePromises(promises, installments) {
  const today = todayISO();
  const instById = new Map(installments.map((i) => [i.recordId, i]));
  const newFollowUps = [];
  const updatedPromises = promises.map((p) => {
    if (p.status !== "فعال") return p;
    if (!p.promise_date || p.promise_date > today) return p;
    const inst = instById.get(p.installment_record_id);
    if (!inst) return p;
    const paid = !isUnpaid(inst.status) || !!inst.paid_at;
    if (paid) {
      return { ...p, status: "انجام شده", resolved_at: nowIso() };
    }
    newFollowUps.push({
      id: uid(),
      installment_record_id: inst.recordId,
      agent_id: inst.assigned_agent_id,
      contact_at: null,
      call_result: null,
      notes: "ایجاد خودکار: تعهد پرداخت نقض شد",
      next_follow_up_date: today,
      created_at: nowIso(),
      system_generated: true,
      reason: "broken_promise",
    });
    return { ...p, status: "نقض تعهد", resolved_at: nowIso() };
  });
  return { updatedPromises, newFollowUps };
}

function isInTodayQueue(inst) {
  const today = todayISO();
  if (!isUnpaid(inst.status)) return false;
  const dueReached = inst.due_date && inst.due_date <= today;
  const scheduled = inst.next_follow_up_date && inst.next_follow_up_date <= today;
  return !!(dueReached || scheduled);
}

function getQueueInfo(inst, promises) {
  const today = todayISO();
  const related = promises
    .filter((p) => p.installment_record_id === inst.recordId)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const latest = related[0];
  const od = daysOverdue(inst.due_date);
  const scheduled = inst.next_follow_up_date && inst.next_follow_up_date <= today;

  if (latest && latest.status === "نقض تعهد") return { rank: 1, label: "تعهد نقض شده", overdueDays: od };
  if (scheduled) return { rank: 2, label: "پیگیری زمان‌بندی‌شده", overdueDays: od };
  if (od !== null && od > 0) return { rank: 3, label: "معوق", overdueDays: od };
  if (od === 0) return { rank: 4, label: "سررسید امروز", overdueDays: od };
  return { rank: 5, label: "—", overdueDays: od };
}

function computeAgentStats(agentId, state) {
  const assigned = state.installments.filter((i) => i.assigned_agent_id === agentId).length;
  const calls = state.followUps.filter((f) => f.agent_id === agentId && !f.system_generated);
  const callCount = calls.length;
  const successfulCalls = calls.filter((c) => POSITIVE_RESULTS.includes(c.call_result)).length;
  const agentPromises = state.promises.filter((p) => p.agent_id === agentId);
  const promisesGiven = agentPromises.length;
  const promisesKept = agentPromises.filter((p) => p.status === "انجام شده").length;
  const promisesBroken = agentPromises.filter((p) => p.status === "نقض تعهد").length;
  const attributions = state.paymentAttributions.filter((a) => a.agent_id === agentId);
  const collectedCount = attributions.length;
  const collectedAmount = attributions.reduce((s, a) => s + (Number(a.attributed_amount) || 0), 0);
  const conversionRate = assigned > 0 ? (collectedCount / assigned) * 100 : 0;
  return { agentId, assigned, callCount, successfulCalls, promisesGiven, promisesKept, promisesBroken, collectedCount, collectedAmount, conversionRate };
}

/* ============================================================
   SEED DATA (demo only — replaced entirely by CSV import)
   ============================================================ */

function seedUsers() {
  return [
    { id: "u-admin", name: "نگار محمدی", mobile: "09120000001", email: "negar@example.com", role: "admin", status: "active", created_at: nowIso() },
    { id: "u-sup", name: "سپهر رادمنش", mobile: "09120000002", email: "sepehr@example.com", role: "supervisor", status: "active", created_at: nowIso() },
    { id: "u-ag1", name: "زهرا احمدی", mobile: "09120000003", email: "zahra@example.com", role: "agent", status: "active", created_at: nowIso() },
    { id: "u-ag2", name: "علی کریمی", mobile: "09120000004", email: "ali@example.com", role: "agent", status: "active", created_at: nowIso() },
  ];
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedInstallments() {
  const base = [
    { customer_name: "مریم صادقی", national_code: "0011122233", mobile: "09131112233", loan_id: 84521, installment_number: 3, due: -10, status: "0", provider_id: 6, agent: "u-ag1", payable: 4200000 },
    { customer_name: "حسین رستمی", national_code: "0022233344", mobile: "09131112234", loan_id: 84522, installment_number: 2, due: -3, status: "0", provider_id: 9, agent: "u-ag1", payable: 2750000 },
    { customer_name: "فاطمه کاظمی", national_code: "0033344455", mobile: "09131112235", loan_id: 84523, installment_number: 5, due: -1, status: "0", provider_id: 10, agent: "u-ag2", payable: 5100000 },
    { customer_name: "رضا نوری", national_code: "0044455566", mobile: "09131112236", loan_id: 84524, installment_number: 1, due: 0, status: "0", provider_id: 12, agent: "u-ag2", payable: 1980000 },
    { customer_name: "سارا حیدری", national_code: "0055566677", mobile: "09131112237", loan_id: 84525, installment_number: 4, due: 5, status: "0", provider_id: 6, agent: null, payable: 3300000 },
    { customer_name: "امیر قاسمی", national_code: "0066677788", mobile: "09131112238", loan_id: 84526, installment_number: 6, due: -20, status: "0", provider_id: 9, agent: "u-ag1", payable: 6400000 },
    { customer_name: "نیلوفر شریفی", national_code: "0077788899", mobile: "09131112239", loan_id: 84527, installment_number: 2, due: -2, status: "1", provider_id: 10, agent: "u-ag2", payable: 2100000, paid: true },
    { customer_name: "بهزاد یوسفی", national_code: "0088899900", mobile: "09131112240", loan_id: 84528, installment_number: 3, due: -7, status: "0", provider_id: 6, agent: null, payable: 3950000 },
  ];
  const stamp = nowIso();
  return base.map((b, idx) => ({
    recordId: uid(),
    installment_id: 900000 + idx,
    loan_id: b.loan_id,
    user_id: 5000 + idx,
    customer_name: b.customer_name,
    mobile: b.mobile,
    national_code: b.national_code,
    installment_number: b.installment_number,
    raw_amount: b.payable,
    amount_excl_tax: b.payable,
    amount_incl_tax: b.payable,
    late_fee_excl_tax: b.due > 0 ? 0 : Math.round(b.payable * 0.01 * Math.max(0, -b.due)),
    late_fee_incl_tax: b.due > 0 ? 0 : Math.round(b.payable * 0.01 * Math.max(0, -b.due)),
    payable_amount: b.payable,
    due_date: addDays(b.due),
    status: b.status,
    paid_at: b.paid ? addDays(b.due + 1) : null,
    provider_id: b.provider_id,
    provider_name: DEFAULT_PROVIDER_MAP[b.provider_id] || "نامشخص",
    assigned_agent_id: b.agent,
    next_follow_up_date: null,
    last_contact_at: null,
    last_call_result: null,
    call_count: 0,
    active_promise_id: null,
    created_at: stamp,
    updated_at: stamp,
  }));
}

function seedFollowUpsAndPromises(installments) {
  const target = installments.find((i) => i.customer_name === "امیر قاسمی");
  if (!target) return { followUps: [], promises: [], installments };
  const followUp = {
    id: uid(),
    installment_record_id: target.recordId,
    agent_id: target.assigned_agent_id,
    contact_at: nowIso(),
    call_result: "تعهد به پرداخت داد",
    notes: "مشتری گفت تا دو روز دیگر پرداخت می‌کند",
    next_follow_up_date: addDays(-1),
    created_at: nowIso(),
  };
  const promise = {
    id: uid(),
    installment_record_id: target.recordId,
    agent_id: target.assigned_agent_id,
    promise_amount: target.payable_amount,
    promise_date: addDays(-1),
    next_follow_up_date: addDays(-1),
    status: "فعال",
    notes: "تعهد اولیه",
    created_at: nowIso(),
    resolved_at: null,
  };
  const updatedInstallments = installments.map((i) =>
    i.recordId === target.recordId
      ? { ...i, last_contact_at: followUp.contact_at, last_call_result: followUp.call_result, call_count: 1, next_follow_up_date: addDays(-1), active_promise_id: promise.id }
      : i
  );
  return { followUps: [followUp], promises: [promise], installments: updatedInstallments };
}

function buildInitialState() {
  const users = seedUsers();
  const installmentsRaw = seedInstallments();
  const { followUps, promises, installments } = seedFollowUpsAndPromises(installmentsRaw);
  return {
    users,
    installments,
    assignments: [],
    followUps,
    promises,
    payments: [],
    paymentAttributions: [],
    importLogs: [],
    providerMap: { ...DEFAULT_PROVIDER_MAP },
    savedMapping: null,
  };
}

/* ============================================================
   STORAGE
   ============================================================ */

async function loadAppState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* not found or unavailable */ }
  return null;
}

async function saveAppState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error("save failed", e);
    return false;
  }
}

/* ============================================================
   SMALL UI ATOMS
   ============================================================ */

const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function Field({ label, children, required, hint }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13px] font-medium text-gray-600">
        {label}{required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}

function TInput(props) { return <input {...props} className={inputCls + " " + (props.className || "")} />; }
function TSelect({ children, ...props }) { return <select {...props} className={inputCls + " " + (props.className || "")}>{children}</select>; }
function TTextarea(props) { return <textarea rows={3} {...props} className={inputCls + " " + (props.className || "")} />; }

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
function DangerGhostButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-indigo-50 text-indigo-600",
    violet: "bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function StatusBadge({ status }) {
  if (isUnpaid(status)) return <Badge tone="red">پرداخت نشده</Badge>;
  return <Badge tone="green">پرداخت شده</Badge>;
}

function QueueBadge({ info }) {
  if (info.rank === 1) return <Badge tone="red">تعهد نقض شده</Badge>;
  if (info.rank === 2) return <Badge tone="violet">پیگیری زمان‌بندی‌شده</Badge>;
  if (info.rank === 3) return <Badge tone="amber">معوق ({fmtNum(info.overdueDays)} روز)</Badge>;
  if (info.rank === 4) return <Badge tone="blue">سررسید امروز</Badge>;
  return <Badge tone="gray">—</Badge>;
}

function EmptyState({ icon: Icon = Inbox, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300"><Icon size={22} /></div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      {subtitle && <p className="max-w-xs text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-300" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "جستجو..."}
        className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-9 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function DataTable({ columns, rows, rowKey, searchable = true, searchPlaceholder, emptyTitle = "رکوردی یافت نشد", emptySubtitle, onRowClick }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter((r) => columns.some((c) => c.searchValue && String(c.searchValue(r) ?? "").toLowerCase().includes(s)));
  }, [rows, q, columns]);

  return (
    <div>
      {searchable && (
        <div className="mb-3 max-w-xs">
          <SearchInput value={q} onChange={setQ} placeholder={searchPlaceholder} />
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50 text-[12px] text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2.5 text-right font-medium">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length}><EmptyState title={emptyTitle} subtitle={emptySubtitle} /></td></tr>
            )}
            {filtered.map((r) => (
              <tr key={rowKey(r)} className={`transition hover:bg-gray-50 ${onRowClick ? "cursor-pointer" : ""}`} onClick={() => onRowClick && onRowClick(r)}>
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-2.5 text-gray-700">{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">{fmtNum(filtered.length)} رکورد</p>
    </div>
  );
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ============================================================
   NAV CONFIG
   ============================================================ */

const NAV_ITEMS = [
  { key: "dashboard", label: "داشبورد", icon: LayoutDashboard, roles: ["admin", "supervisor", "agent"] },
  { key: "today", label: "پیگیری‌های امروز", icon: ListChecks, roles: ["admin", "supervisor", "agent"] },
  { key: "installments", label: "اقساط", icon: Receipt, roles: ["admin", "supervisor", "agent"] },
  { key: "promises", label: "تعهدات پرداخت", icon: Handshake, roles: ["admin", "supervisor", "agent"] },
  { key: "next", label: "پیگیری‌های بعدی", icon: CalendarClock, roles: ["admin", "supervisor", "agent"] },
  { key: "performance", label: "عملکرد کارشناسان", icon: Trophy, roles: ["admin", "supervisor"] },
  { key: "assignment", label: "تخصیص پرونده‌ها", icon: Shuffle, roles: ["admin", "supervisor"] },
  { key: "sync", label: "همگام‌سازی اقساط", icon: UploadCloud, roles: ["admin"] },
  { key: "users", label: "کاربران", icon: Users2, roles: ["admin"] },
  { key: "settings", label: "تنظیمات", icon: SettingsIcon, roles: ["admin"] },
];

/* ============================================================
   LOGIN SCREEN  (prototype-only, see note in Settings)
   ============================================================ */

function LoginScreen({ users, onLogin }) {
  const active = users.filter((u) => u.status === "active");
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-sm">
            <Coins size={22} />
          </div>
          <h1 className="text-lg font-bold text-gray-800">سامانه وصول مطالبات</h1>
          <p className="mt-1 text-[13px] text-gray-400">حساب کاربری خود را برای ورود انتخاب کنید</p>
        </div>
        <Card className="!p-3">
          <div className="flex flex-col gap-1.5">
            {active.map((u) => (
              <button
                key={u.id}
                onClick={() => onLogin(u)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-right transition hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{u.name}</p>
                  <p className="text-[11px] text-gray-400">{u.mobile}</p>
                </div>
                <Badge tone={u.role === "admin" ? "violet" : u.role === "supervisor" ? "blue" : "gray"}>{ROLE_LABEL[u.role]}</Badge>
              </button>
            ))}
            {active.length === 0 && <EmptyState title="کاربری یافت نشد" />}
          </div>
        </Card>
        <p className="mt-4 text-center text-[11px] leading-5 text-gray-300">
          نسخه فاز ۱ — ورود نمایشی بدون رمز عبور. احراز هویت امن در فاز بعدی و با اتصال به بک‌اند پیاده‌سازی می‌شود.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   SIDEBAR / TOPBAR
   ============================================================ */

function SidebarContent({ page, setPage, role, user, onLogout, onNavigate }) {
  return (
    <div className="flex h-full flex-col text-gray-300">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-l from-indigo-500 to-violet-500 text-white"><Coins size={17} /></div>
        <div>
          <p className="text-sm font-bold text-white">سامانه وصول</p>
          <p className="text-[11px] text-gray-500">مطالبات و اقساط معوق</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.filter((n) => n.roles.includes(role)).map((n) => {
          const Icon = n.icon;
          const isActive = page === n.key;
          return (
            <button
              key={n.key}
              onClick={() => { setPage(n.key); onNavigate && onNavigate(); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${
                isActive ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              }`}
            >
              <Icon size={16} />
              {n.label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-2 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[12px] font-bold text-white">{user.name.slice(0, 1)}</div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="text-[11px] text-gray-500">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-gray-400 transition hover:bg-white/5 hover:text-gray-200">
          <LogOut size={15} /> خروج
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   CALL RESULT + PROMISE MODALS
   ============================================================ */

function CallResultModal({ open, onClose, installment, currentUser, onSubmit }) {
  const [callResult, setCallResult] = useState("");
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setCallResult(""); setNotes(""); setNextDate(""); setErr(""); } }, [open, installment]);

  if (!installment) return null;

  function submit() {
    if (!callResult) { setErr("نتیجه تماس را انتخاب کنید"); return; }
    onSubmit({ callResult, notes, nextDate: nextDate || null });
  }

  return (
    <Modal open={open} onClose={onClose} title="ثبت نتیجه تماس">
      <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2.5 text-[12px] text-gray-500">
        <span className="font-medium text-gray-700">{installment.customer_name}</span> · کد ملی {installment.national_code} · قسط {installment.installment_number} · Loan {installment.loan_id}
      </div>
      <Field label="نتیجه تماس" required>
        <TSelect value={callResult} onChange={(e) => setCallResult(e.target.value)}>
          <option value="">انتخاب کنید...</option>
          {CALL_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
        </TSelect>
      </Field>
      <Field label="توضیحات">
        <TTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="توضیحات تماس..." />
      </Field>
      <Field label="تاریخ پیگیری بعدی" hint="در صورت نیاز به تماس مجدد">
        <TInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
      </Field>
      {err && <p className="mb-3 text-[12px] text-rose-500">{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <GhostButton onClick={onClose}>انصراف</GhostButton>
        <PrimaryButton onClick={submit}>ثبت نتیجه</PrimaryButton>
      </div>
    </Modal>
  );
}

function PromiseModal({ open, onClose, installment, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open && installment) {
      setAmount(installment.payable_amount || "");
      setPromiseDate("");
      setNextDate("");
      setNotes("");
      setErr("");
    }
  }, [open, installment]);

  if (!installment) return null;

  function submit() {
    if (!amount || !promiseDate) { setErr("مبلغ تعهد و تاریخ تعهد پرداخت الزامی است"); return; }
    onSubmit({ amount: Number(amount), promiseDate, nextDate: nextDate || promiseDate, notes });
  }

  return (
    <Modal open={open} onClose={onClose} title="ثبت تعهد پرداخت">
      <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2.5 text-[12px] text-gray-500">
        <span className="font-medium text-gray-700">{installment.customer_name}</span> · کد ملی {installment.national_code} · قسط {installment.installment_number}
      </div>
      <Field label="مبلغ تعهد" required>
        <TInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="تاریخ تعهد پرداخت" required>
        <TInput type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
      </Field>
      <Field label="تاریخ پیگیری بعدی" hint="پیش‌فرض: همان تاریخ تعهد">
        <TInput type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
      </Field>
      <Field label="توضیحات">
        <TTextarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {err && <p className="mb-3 text-[12px] text-rose-500">{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <GhostButton onClick={onClose}>انصراف</GhostButton>
        <PrimaryButton onClick={submit}>ثبت تعهد</PrimaryButton>
      </div>
    </Modal>
  );
}

/* ============================================================
   INSTALLMENT DETAIL DRAWER
   ============================================================ */

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 py-2 text-[13px] last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-700">{value ?? "—"}</span>
    </div>
  );
}

function InstallmentDetailDrawer({ installment, onClose, agents, currentUser, can, state, onOpenCall, onOpenPromise, onReassign }) {
  const [tab, setTab] = useState("info");
  const [reassignId, setReassignId] = useState("");

  useEffect(() => { if (installment) { setTab("info"); setReassignId(installment.assigned_agent_id || ""); } }, [installment]);

  if (!installment) return null;

  const followUps = state.followUps.filter((f) => f.installment_record_id === installment.recordId).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const promises = state.promises.filter((p) => p.installment_record_id === installment.recordId).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  const payments = state.payments.filter((p) => p.installment_record_id === installment.recordId);
  const agentName = agents.find((a) => a.id === installment.assigned_agent_id)?.name || "بدون کارشناس";
  const od = daysOverdue(installment.due_date);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-slate-900/40" onClick={onClose} />
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" dir="rtl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <h3 className="font-bold text-gray-800">{installment.customer_name || "بدون نام"}</h3>
            <p className="text-[12px] text-gray-400">کد ملی {installment.national_code} · Loan {installment.loan_id} · قسط {installment.installment_number}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-100 px-5 pt-3">
          {[["info", "اطلاعات"], ["history", "تاریخچه"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-2 pb-2.5 text-[13px] font-medium transition ${tab === k ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400"}`}>{l}</button>
          ))}
        </div>

        <div className="px-5 py-4">
          {tab === "info" && (
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <StatusBadge status={installment.status} />
                <Badge tone="blue">{installment.provider_name}</Badge>
                {isUnpaid(installment.status) && od !== null && od >= 0 && <Badge tone="amber">{od === 0 ? "سررسید امروز" : `${fmtNum(od)} روز تاخیر`}</Badge>}
              </div>
              <Card className="!p-4">
                <DetailRow label="Installment ID" value={installment.installment_id ?? "—"} />
                <DetailRow label="تاریخ سررسید" value={fmtJalali(installment.due_date)} />
                <DetailRow label="مبلغ قسط" value={fmtNum(installment.amount_incl_tax ?? installment.raw_amount) + " ریال"} />
                <DetailRow label="جریمه" value={fmtNum(installment.late_fee_incl_tax) + " ریال"} />
                <DetailRow label="مبلغ قابل پرداخت" value={fmtNum(installment.payable_amount) + " ریال"} />
                <DetailRow label="موبایل" value={installment.mobile} />
                <DetailRow label="شماره ضروری" value={installment.essential_phone || "—"} />
                <DetailRow label="استان/شهر" value={installment.state_name || "—"} />
                <DetailRow label="کارشناس مسئول" value={agentName} />
                <DetailRow label="تعداد تماس" value={fmtNum(installment.call_count || 0)} />
                <DetailRow label="آخرین تماس" value={fmtJalaliDateTime(installment.last_contact_at)} />
                <DetailRow label="آخرین نتیجه" value={installment.last_call_result || "—"} />
                <DetailRow label="تاریخ پیگیری بعدی" value={fmtJalali(installment.next_follow_up_date)} />
              </Card>

              <div className="mt-4 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => onOpenCall(installment)}><PhoneCall size={15} /> ثبت نتیجه تماس</PrimaryButton>
                <GhostButton onClick={() => onOpenPromise(installment)}><Handshake size={15} /> ثبت تعهد پرداخت</GhostButton>
              </div>

              {can.reassign && (
                <Card className="mt-4 !p-4">
                  <p className="mb-2 text-[13px] font-medium text-gray-600">تغییر کارشناس مسئول</p>
                  <div className="flex gap-2">
                    <TSelect value={reassignId || ""} onChange={(e) => setReassignId(e.target.value)}>
                      <option value="">بدون کارشناس</option>
                      {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </TSelect>
                    <GhostButton onClick={() => onReassign(installment, reassignId || null)}>ثبت</GhostButton>
                  </div>
                </Card>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-gray-600"><PhoneCall size={14} /> تماس‌ها ({followUps.length})</p>
                <div className="space-y-2">
                  {followUps.length === 0 && <p className="text-[12px] text-gray-400">تماسی ثبت نشده است.</p>}
                  {followUps.map((f) => (
                    <div key={f.id} className="rounded-xl border border-gray-100 px-3 py-2.5 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{f.call_result || "پیگیری خودکار"}</span>
                        <span className="text-gray-400">{fmtJalaliDateTime(f.contact_at || f.created_at)}</span>
                      </div>
                      {f.notes && <p className="mt-1 text-gray-500">{f.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-gray-600"><Handshake size={14} /> تعهدات پرداخت ({promises.length})</p>
                <div className="space-y-2">
                  {promises.length === 0 && <p className="text-[12px] text-gray-400">تعهدی ثبت نشده است.</p>}
                  {promises.map((p) => (
                    <div key={p.id} className="rounded-xl border border-gray-100 px-3 py-2.5 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{fmtNum(p.promise_amount)} ریال</span>
                        <Badge tone={p.status === "انجام شده" ? "green" : p.status === "نقض تعهد" ? "red" : p.status === "لغو شده" ? "gray" : "amber"}>{p.status}</Badge>
                      </div>
                      <p className="mt-1 text-gray-500">تاریخ تعهد: {fmtJalali(p.promise_date)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-gray-600"><Coins size={14} /> پرداخت‌ها ({payments.length})</p>
                <div className="space-y-2">
                  {payments.length === 0 && <p className="text-[12px] text-gray-400">پرداختی شناسایی نشده است.</p>}
                  {payments.map((p) => (
                    <div key={p.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-emerald-700">{fmtNum(p.amount)} ریال</span>
                        <span className="text-gray-400">{fmtJalali(p.payment_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: DASHBOARD
   ============================================================ */

function KpiCard({ icon: Icon, label, value, tone = "indigo" }) {
  const tones = {
    indigo: "from-indigo-500 to-violet-500",
    rose: "from-rose-500 to-red-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-l text-white ${tones[tone]}`}><Icon size={17} /></div>
        <div className="min-w-0">
          <p className="truncate text-[12px] text-gray-400">{label}</p>
          <p className="text-base font-bold text-gray-800">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function DashboardPage({ state, currentUser, scopeInstallments }) {
  const inst = scopeInstallments;
  const today = todayISO();
  const todayQueue = inst.filter(isInTodayQueue);
  const callsToday = state.followUps.filter((f) => !f.system_generated && (f.contact_at || "").slice(0, 10) === today && (currentUser.role !== "agent" || f.agent_id === currentUser.id));
  const activePromises = state.promises.filter((p) => p.status === "فعال" && (currentUser.role !== "agent" || p.agent_id === currentUser.id));
  const brokenPromises = state.promises.filter((p) => p.status === "نقض تعهد" && (currentUser.role !== "agent" || p.agent_id === currentUser.id));
  const payments = state.payments.filter((p) => {
    if (currentUser.role !== "agent") return true;
    const attr = state.paymentAttributions.find((a) => a.payment_id === p.id);
    return attr && attr.agent_id === currentUser.id;
  });
  const collectedAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const overdueCount = inst.filter((i) => isUnpaid(i.status) && daysOverdue(i.due_date) > 0).length;
  const unassignedCount = state.installments.filter((i) => isUnpaid(i.status) && !i.assigned_agent_id).length;

  const recentPayments = [...payments].sort((a, b) => (b.detected_at || "").localeCompare(a.detected_at || "")).slice(0, 5);
  const recentPromises = [...state.promises].filter((p) => currentUser.role !== "agent" || p.agent_id === currentUser.id).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 5);
  const recentFollowUps = [...state.followUps].filter((f) => currentUser.role !== "agent" || f.agent_id === currentUser.id).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).slice(0, 5);

  const agentUsers = state.users.filter((u) => u.role === "agent");
  const leaderboard = agentUsers.map((a) => computeAgentStats(a.id, state)).sort((a, b) => b.collectedAmount - a.collectedAmount).slice(0, 5);

  return (
    <div>
      <PageHeader title="داشبورد" subtitle={`${fmtJalali(today)} — خلاصه وضعیت وصول مطالبات`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={ListChecks} label="پیگیری‌های امروز" value={fmtNum(todayQueue.length)} tone="indigo" />
        <KpiCard icon={PhoneCall} label="تماس‌های انجام‌شده" value={fmtNum(callsToday.length)} tone="emerald" />
        <KpiCard icon={Clock} label="تماس‌های باقی‌مانده" value={fmtNum(Math.max(0, todayQueue.length - callsToday.length))} tone="amber" />
        <KpiCard icon={Handshake} label="تعهد به پرداخت فعال" value={fmtNum(activePromises.length)} tone="indigo" />
        <KpiCard icon={ShieldAlert} label="تعهدات نقض‌شده" value={fmtNum(brokenPromises.length)} tone="rose" />
        <KpiCard icon={CheckCircle2} label="وصول موفق" value={fmtNum(payments.length)} tone="emerald" />
        <KpiCard icon={Coins} label="مبلغ وصول‌شده (ریال)" value={fmtNum(collectedAmount)} tone="emerald" />
        <KpiCard icon={AlertTriangle} label="اقساط معوق" value={fmtNum(overdueCount)} tone="rose" />
        {currentUser.role !== "agent" && <KpiCard icon={Users2} label="پرونده‌های بدون کارشناس" value={fmtNum(unassignedCount)} tone="amber" />}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <p className="mb-3 text-sm font-bold text-gray-700">پرداخت‌های اخیر</p>
          <div className="space-y-2">
            {recentPayments.length === 0 && <p className="text-[12px] text-gray-400">موردی ثبت نشده است.</p>}
            {recentPayments.map((p) => {
              const i = state.installments.find((x) => x.recordId === p.installment_record_id);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-50 px-3 py-2 text-[12px]">
                  <span className="text-gray-600">{i?.customer_name || "—"}</span>
                  <span className="font-medium text-emerald-600">{fmtNum(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-bold text-gray-700">تعهدات اخیر</p>
          <div className="space-y-2">
            {recentPromises.length === 0 && <p className="text-[12px] text-gray-400">موردی ثبت نشده است.</p>}
            {recentPromises.map((p) => {
              const i = state.installments.find((x) => x.recordId === p.installment_record_id);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-50 px-3 py-2 text-[12px]">
                  <span className="text-gray-600">{i?.customer_name || "—"}</span>
                  <Badge tone={p.status === "انجام شده" ? "green" : p.status === "نقض تعهد" ? "red" : "amber"}>{p.status}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <p className="mb-3 text-sm font-bold text-gray-700">پیگیری‌های اخیر</p>
          <div className="space-y-2">
            {recentFollowUps.length === 0 && <p className="text-[12px] text-gray-400">موردی ثبت نشده است.</p>}
            {recentFollowUps.map((f) => {
              const i = state.installments.find((x) => x.recordId === f.installment_record_id);
              return (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-gray-50 px-3 py-2 text-[12px]">
                  <span className="text-gray-600">{i?.customer_name || "—"}</span>
                  <span className="text-gray-400">{f.call_result || "خودکار"}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {currentUser.role !== "agent" && (
        <Card className="mt-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-700"><Trophy size={15} className="text-amber-500" /> برترین کارشناسان وصول</p>
          <div className="space-y-1.5">
            {leaderboard.map((s, idx) => {
              const u = state.users.find((x) => x.id === s.agentId);
              return (
                <div key={s.agentId} className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px] hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">{fmtNum(idx + 1)}</span>
                    <span className="font-medium text-gray-700">{u?.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[12px] text-gray-500">
                    <span>{fmtNum(s.collectedAmount)} ریال</span>
                    <span>{fmtNum(s.collectedCount)} وصول</span>
                    <span>{s.conversionRate.toFixed(0)}٪</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   PAGE: TODAY / NEXT / INSTALLMENTS / PROMISES  (shared filters)
   ============================================================ */

function ProviderFilterSelect({ value, onChange, providerMap }) {
  return (
    <TSelect value={value} onChange={(e) => onChange(e.target.value)} className="!w-40">
      <option value="">همه پروایدرها</option>
      {Object.entries(providerMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
    </TSelect>
  );
}

function TodayFollowupsPage({ state, currentUser, scopeInstallments, agents, openDetail }) {
  const [providerId, setProviderId] = useState("");
  const queue = useMemo(() => {
    let list = scopeInstallments.filter(isInTodayQueue);
    if (providerId) list = list.filter((i) => String(i.provider_id) === String(providerId));
    return list
      .map((i) => ({ ...i, __q: getQueueInfo(i, state.promises) }))
      .sort((a, b) => a.__q.rank - b.__q.rank || (b.__q.overdueDays || 0) - (a.__q.overdueDays || 0));
  }, [scopeInstallments, providerId, state.promises]);

  const columns = [
    { key: "customer_name", header: "نام مشتری", searchValue: (r) => r.customer_name, render: (r) => r.customer_name || "—" },
    { key: "mobile", header: "موبایل", searchValue: (r) => r.mobile },
    { key: "essential_phone", header: "شماره ضروری", searchValue: (r) => r.essential_phone, render: (r) => r.essential_phone || "—" },
    { key: "national_code", header: "کد ملی", searchValue: (r) => r.national_code },
    { key: "state_name", header: "استان/شهر", searchValue: (r) => r.state_name, render: (r) => r.state_name || "—" },
    { key: "loan_id", header: "Loan ID", searchValue: (r) => r.loan_id },
    { key: "installment_number", header: "شماره قسط" },
    { key: "due_date", header: "تاریخ سررسید", render: (r) => fmtJalali(r.due_date) },
    { key: "od", header: "روزهای تاخیر", render: (r) => (r.__q.overdueDays > 0 ? fmtNum(r.__q.overdueDays) : "—") },
    { key: "payable_amount", header: "مبلغ قابل پرداخت", render: (r) => fmtNum(r.payable_amount) },
    { key: "provider_name", header: "Provider", render: (r) => <Badge tone="blue">{r.provider_name}</Badge> },
    { key: "agent", header: "کارشناس مسئول", render: (r) => agents.find((a) => a.id === r.assigned_agent_id)?.name || "—" },
    { key: "last_call_result", header: "نتیجه آخرین تماس", render: (r) => r.last_call_result || "—" },
    { key: "priority", header: "وضعیت", render: (r) => <QueueBadge info={r.__q} /> },
    { key: "actions", header: "عملیات", render: (r) => <PrimaryButton onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="!px-3 !py-1.5 !text-[12px]"><PhoneCall size={13} /> پیگیری</PrimaryButton> },
  ];

  return (
    <div>
      <PageHeader title="پیگیری‌های امروز" subtitle="اولویت: تعهد نقض‌شده ← پیگیری زمان‌بندی‌شده ← معوق ← سررسید امروز" />
      <div className="mb-3"><ProviderFilterSelect value={providerId} onChange={setProviderId} providerMap={state.providerMap} /></div>
      <DataTable columns={columns} rows={queue} rowKey={(r) => r.recordId} onRowClick={openDetail} searchPlaceholder="جستجوی نام، کد ملی، موبایل..." emptyTitle="پیگیری امروز وجود ندارد" emptySubtitle="همه پرونده‌ها به‌روز هستند 🎉" />
    </div>
  );
}

function InstallmentsPage({ state, scopeInstallments, agents, openDetail }) {
  const [providerId, setProviderId] = useState("");
  const [status, setStatus] = useState("");
  const [agentId, setAgentId] = useState("");

  const rows = useMemo(() => {
    let list = scopeInstallments;
    if (providerId) list = list.filter((i) => String(i.provider_id) === String(providerId));
    if (status) list = list.filter((i) => (status === "unpaid" ? isUnpaid(i.status) : !isUnpaid(i.status)));
    if (agentId) list = list.filter((i) => (agentId === "none" ? !i.assigned_agent_id : i.assigned_agent_id === agentId));
    return list;
  }, [scopeInstallments, providerId, status, agentId]);

  const columns = [
    { key: "customer_name", header: "نام مشتری", searchValue: (r) => r.customer_name, render: (r) => r.customer_name || "—" },
    { key: "mobile", header: "موبایل", searchValue: (r) => r.mobile },
    { key: "national_code", header: "کد ملی", searchValue: (r) => r.national_code },
    { key: "loan_id", header: "Loan ID", searchValue: (r) => r.loan_id },
    { key: "installment_id", header: "Installment ID", searchValue: (r) => r.installment_id },
    { key: "installment_number", header: "شماره قسط" },
    { key: "due_date", header: "تاریخ سررسید", render: (r) => fmtJalali(r.due_date) },
    { key: "amount", header: "مبلغ قسط", render: (r) => fmtNum(r.amount_incl_tax ?? r.raw_amount) },
    { key: "fee", header: "جریمه", render: (r) => fmtNum(r.late_fee_incl_tax) },
    { key: "payable", header: "مبلغ قابل پرداخت", render: (r) => fmtNum(r.payable_amount) },
    { key: "provider_name", header: "Provider", render: (r) => <Badge tone="blue">{r.provider_name}</Badge> },
    { key: "status", header: "وضعیت پرداخت", render: (r) => <StatusBadge status={r.status} /> },
    { key: "agent", header: "کارشناس مسئول", render: (r) => agents.find((a) => a.id === r.assigned_agent_id)?.name || "—" },
  ];

  return (
    <div>
      <PageHeader title="اقساط" subtitle="فهرست کامل اقساط وارد شده به سامانه" />
      <div className="mb-3 flex flex-wrap gap-2">
        <ProviderFilterSelect value={providerId} onChange={setProviderId} providerMap={state.providerMap} />
        <TSelect value={status} onChange={(e) => setStatus(e.target.value)} className="!w-40">
          <option value="">همه وضعیت‌ها</option>
          <option value="unpaid">پرداخت نشده</option>
          <option value="paid">پرداخت شده</option>
        </TSelect>
        <TSelect value={agentId} onChange={(e) => setAgentId(e.target.value)} className="!w-44">
          <option value="">همه کارشناسان</option>
          <option value="none">بدون کارشناس</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </TSelect>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.recordId} onRowClick={openDetail} searchPlaceholder="جستجوی نام، کد ملی، Loan ID..." emptyTitle="قسطی یافت نشد" emptySubtitle="از صفحه «همگام‌سازی اقساط» فایل CSV بارگذاری کنید" />
    </div>
  );
}

function PromisesPage({ state, scopeInstallments, agents, openDetail }) {
  const rows = useMemo(() => {
    const instIds = new Set(scopeInstallments.map((i) => i.recordId));
    const today = todayISO();
    return state.promises
      .filter((p) => instIds.has(p.installment_record_id))
      .map((p) => {
        const inst = state.installments.find((i) => i.recordId === p.installment_record_id);
        const overdue = p.status === "فعال" && p.promise_date < today;
        return { ...p, __inst: inst, __overdue: overdue };
      })
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [state.promises, state.installments, scopeInstallments]);

  const columns = [
    { key: "customer_name", header: "نام مشتری", searchValue: (r) => r.__inst?.customer_name, render: (r) => r.__inst?.customer_name || "—" },
    { key: "national_code", header: "کد ملی", searchValue: (r) => r.__inst?.national_code, render: (r) => r.__inst?.national_code },
    { key: "loan_id", header: "Loan ID", render: (r) => r.__inst?.loan_id },
    { key: "installment_number", header: "شماره قسط", render: (r) => r.__inst?.installment_number },
    { key: "promise_amount", header: "مبلغ تعهد", render: (r) => fmtNum(r.promise_amount) },
    { key: "promise_date", header: "تاریخ تعهد", render: (r) => fmtJalali(r.promise_date) },
    { key: "status", header: "وضعیت تعهد", render: (r) => (
      <div className="flex flex-col gap-1">
        <Badge tone={r.status === "انجام شده" ? "green" : r.status === "نقض تعهد" ? "red" : r.status === "لغو شده" ? "gray" : "amber"}>{r.status}</Badge>
        {r.__overdue && <span className="text-[11px] font-medium text-rose-500">تعهد انجام نشده</span>}
      </div>
    ) },
    { key: "payment_status", header: "وضعیت پرداخت", render: (r) => r.__inst && <StatusBadge status={r.__inst.status} /> },
    { key: "agent", header: "کارشناس مسئول", render: (r) => agents.find((a) => a.id === r.agent_id)?.name || "—" },
    { key: "actions", header: "عملیات", render: (r) => (
      <GhostButton onClick={(e) => { e.stopPropagation(); r.__inst && openDetail(r.__inst); }} className="!px-3 !py-1.5 !text-[12px]">
        {r.__overdue ? "پیگیری فوری" : "مشاهده"}
      </GhostButton>
    ) },
  ];

  return (
    <div>
      <PageHeader title="تعهدات پرداخت" subtitle="مدیریت تعهدهای فعال، انجام‌شده و نقض‌شده" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} searchPlaceholder="جستجوی نام یا کد ملی..." emptyTitle="تعهدی ثبت نشده است" />
    </div>
  );
}

function NextFollowupsPage({ state, scopeInstallments, agents, openDetail }) {
  const rows = useMemo(() => {
    const today = todayISO();
    return scopeInstallments.filter((i) => isUnpaid(i.status) && i.next_follow_up_date && i.next_follow_up_date > today);
  }, [scopeInstallments]);

  const columns = [
    { key: "customer_name", header: "نام مشتری", searchValue: (r) => r.customer_name, render: (r) => r.customer_name || "—" },
    { key: "national_code", header: "کد ملی", searchValue: (r) => r.national_code },
    { key: "loan_id", header: "Loan ID" },
    { key: "installment_number", header: "شماره قسط" },
    { key: "next_follow_up_date", header: "تاریخ پیگیری بعدی", render: (r) => fmtJalali(r.next_follow_up_date) },
    { key: "last_call_result", header: "آخرین نتیجه تماس", render: (r) => r.last_call_result || "—" },
    { key: "promise", header: "تعهد پرداخت", render: (r) => (r.active_promise_id ? <Badge tone="amber">دارد</Badge> : "—") },
    { key: "agent", header: "کارشناس مسئول", render: (r) => agents.find((a) => a.id === r.assigned_agent_id)?.name || "—" },
    { key: "actions", header: "عملیات", render: (r) => <GhostButton onClick={(e) => { e.stopPropagation(); openDetail(r); }} className="!px-3 !py-1.5 !text-[12px]">مشاهده</GhostButton> },
  ];

  return (
    <div>
      <PageHeader title="پیگیری‌های بعدی" subtitle="پرونده‌هایی که تاریخ پیگیری آن‌ها در آینده است" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.recordId} onRowClick={openDetail} searchPlaceholder="جستجوی نام یا کد ملی..." emptyTitle="موردی برای آینده زمان‌بندی نشده است" />
    </div>
  );
}

/* ============================================================
   PAGE: ASSIGNMENT
   ============================================================ */

function AssignmentPage({ state, updateState, agents, currentUser }) {
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [providerId, setProviderId] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [targetAgent, setTargetAgent] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rows = useMemo(() => {
    let list = state.installments.filter((i) => isUnpaid(i.status));
    if (onlyUnassigned) list = list.filter((i) => !i.assigned_agent_id);
    if (providerId) list = list.filter((i) => String(i.provider_id) === String(providerId));
    return list;
  }, [state.installments, onlyUnassigned, providerId]);

  function toggle(recordId) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(recordId) ? next.delete(recordId) : next.add(recordId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.recordId))));
  }

  function doAssign() {
    if (!targetAgent || selected.size === 0) return;
    const stamp = nowIso();
    updateState((prev) => {
      const newAssignments = [];
      const installments = prev.installments.map((i) => {
        if (!selected.has(i.recordId)) return i;
        if (i.assigned_agent_id === targetAgent) return i;
        newAssignments.push({
          id: uid(),
          installment_record_id: i.recordId,
          old_agent_id: i.assigned_agent_id || null,
          new_agent_id: targetAgent,
          assigned_at: stamp,
          reassigned_at: i.assigned_agent_id ? stamp : null,
          reason: reason || (i.assigned_agent_id ? "تخصیص مجدد دستی" : "تخصیص اولیه"),
        });
        return { ...i, assigned_agent_id: targetAgent };
      });
      return { ...prev, installments, assignments: [...prev.assignments, ...newAssignments] };
    });
    setSelected(new Set());
    setTargetAgent("");
    setReason("");
    setConfirmOpen(false);
  }

  const columns = [
    { key: "sel", header: "", render: (r) => <input type="checkbox" checked={selected.has(r.recordId)} onChange={() => toggle(r.recordId)} onClick={(e) => e.stopPropagation()} className="h-4 w-4 rounded accent-indigo-600" /> },
    { key: "customer_name", header: "نام مشتری", searchValue: (r) => r.customer_name, render: (r) => r.customer_name || "—" },
    { key: "national_code", header: "کد ملی", searchValue: (r) => r.national_code },
    { key: "loan_id", header: "Loan ID" },
    { key: "installment_number", header: "شماره قسط" },
    { key: "payable_amount", header: "مبلغ قابل پرداخت", render: (r) => fmtNum(r.payable_amount) },
    { key: "provider_name", header: "Provider", render: (r) => <Badge tone="blue">{r.provider_name}</Badge> },
    { key: "agent", header: "کارشناس فعلی", render: (r) => agents.find((a) => a.id === r.assigned_agent_id)?.name || <span className="text-rose-500">بدون کارشناس</span> },
  ];

  return (
    <div className="pb-20">
      <PageHeader title="تخصیص پرونده‌ها" subtitle="تخصیص یا تخصیص مجدد اقساط معوق به کارشناسان" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setOnlyUnassigned((v) => !v)} className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] transition ${onlyUnassigned ? "border-indigo-200 bg-indigo-50 text-indigo-600" : "border-gray-200 bg-white text-gray-500"}`}>
          <CircleDot size={14} /> فقط پرونده‌های بدون کارشناس
        </button>
        <ProviderFilterSelect value={providerId} onChange={setProviderId} providerMap={state.providerMap} />
        <GhostButton onClick={toggleAll} className="!px-3 !py-2 !text-[12px]">{selected.size === rows.length && rows.length > 0 ? "لغو انتخاب همه" : "انتخاب همه"}</GhostButton>
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.recordId} searchPlaceholder="جستجوی نام یا کد ملی..." emptyTitle="پرونده‌ای برای تخصیص یافت نشد" />

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur sm:left-64">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-gray-600">{fmtNum(selected.size)} پرونده انتخاب شده</span>
            <TSelect value={targetAgent} onChange={(e) => setTargetAgent(e.target.value)} className="!w-48">
              <option value="">انتخاب کارشناس...</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </TSelect>
            <PrimaryButton disabled={!targetAgent} onClick={() => setConfirmOpen(true)}>تخصیص</PrimaryButton>
          </div>
        </div>
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="تایید تخصیص">
        <p className="mb-4 text-[13px] text-gray-600">
          {fmtNum(selected.size)} پرونده به کارشناس «{agents.find((a) => a.id === targetAgent)?.name}» تخصیص داده می‌شود.
        </p>
        <Field label="دلیل (اختیاری)">
          <TInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: توزیع مجدد بار کاری" />
        </Field>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={() => setConfirmOpen(false)}>انصراف</GhostButton>
          <PrimaryButton onClick={doAssign}>تایید تخصیص</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   PAGE: AGENT PERFORMANCE
   ============================================================ */

function AgentPerformancePage({ state }) {
  const agentUsers = state.users.filter((u) => u.role === "agent");
  const stats = agentUsers.map((a) => ({ user: a, ...computeAgentStats(a.id, state) })).sort((a, b) => b.collectedAmount - a.collectedAmount);

  const columns = [
    { key: "name", header: "کارشناس", searchValue: (r) => r.user.name, render: (r) => r.user.name },
    { key: "assigned", header: "تعداد اقساط تخصیص داده‌شده", render: (r) => fmtNum(r.assigned) },
    { key: "calls", header: "تعداد تماس", render: (r) => fmtNum(r.callCount) },
    { key: "success", header: "تماس موفق", render: (r) => fmtNum(r.successfulCalls) },
    { key: "given", header: "تعهد پرداخت", render: (r) => fmtNum(r.promisesGiven) },
    { key: "kept", header: "تعهد انجام‌شده", render: (r) => fmtNum(r.promisesKept) },
    { key: "broken", header: "تعهد نقض‌شده", render: (r) => fmtNum(r.promisesBroken) },
    { key: "collected", header: "اقساط وصول‌شده", render: (r) => fmtNum(r.collectedCount) },
    { key: "amount", header: "مبلغ وصول‌شده", render: (r) => fmtNum(r.collectedAmount) },
    { key: "conv", header: "نرخ تبدیل", render: (r) => `${r.conversionRate.toFixed(0)}٪` },
  ];

  return (
    <div>
      <PageHeader title="عملکرد کارشناسان" subtitle="نرخ تبدیل = اقساط وصول‌شده نسبت‌داده‌شده ÷ اقساط تخصیص داده‌شده" />
      <Card className="mb-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-700"><Trophy size={15} className="text-amber-500" /> برترین کارشناسان وصول</p>
        <div className="space-y-1.5">
          {stats.slice(0, 5).map((s, idx) => (
            <div key={s.agentId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-[13px] hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-500">{fmtNum(idx + 1)}</span>
                <span className="font-medium text-gray-700">{s.user.name}</span>
              </div>
              <div className="flex items-center gap-4 text-[12px] text-gray-500">
                <span>{fmtNum(s.collectedAmount)} ریال</span>
                <span>{fmtNum(s.collectedCount)} وصول موفق</span>
                <span>{s.conversionRate.toFixed(0)}٪ تبدیل</span>
                <span>{fmtNum(s.promisesKept)} تعهد انجام‌شده</span>
              </div>
            </div>
          ))}
          {stats.length === 0 && <p className="text-[12px] text-gray-400">کارشناسی ثبت نشده است.</p>}
        </div>
      </Card>
      <DataTable columns={columns} rows={stats} rowKey={(r) => r.agentId} searchable={false} emptyTitle="داده‌ای برای نمایش نیست" />
    </div>
  );
}

/* ============================================================
   PAGE: CSV SYNC
   ============================================================ */

function SyncPage({ state, updateState, currentUser }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState("");
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const mappedFields = new Set(Object.values(mapping));
  const hasBusinessIdentityMapping = mappedFields.has("national_code") && mappedFields.has("loan_id") && mappedFields.has("installment_number");
  const hasIdMapping = mappedFields.has("installment_id");
  const canIdentifyRows = hasBusinessIdentityMapping || hasIdMapping;
  const hasQueueFields = mappedFields.has("due_date") && mappedFields.has("status");

  function handleFile(file) {
    if (!file) return;
    setParseError("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!parsed.meta || !parsed.meta.fields || parsed.meta.fields.length === 0) {
        setParseError("فایل CSV قابل خواندن نبود یا ستونی یافت نشد.");
        return;
      }
      const headers = parsed.meta.fields;
      setCsvHeaders(headers);
      setCsvRows(parsed.data);
      const initialMapping = {};
      headers.forEach((h) => {
        const savedMatch = state.savedMapping && state.savedMapping[h];
        initialMapping[h] = savedMatch || guessField(h);
      });
      setMapping(initialMapping);
      setStep(2);
    };
    reader.onerror = () => setParseError("خطا در خواندن فایل.");
    reader.readAsText(file, "utf-8");
  }

  function confirmImport() {
    let localResult = null;
    updateState((prev) => {
      const { list, inserted, updated, errors, paymentEvents, totalRows } = runImport(prev.installments, csvRows, mapping, prev.providerMap);
      const { payments: newPayments, attributions: newAttributions } = buildPayments(paymentEvents);
      const { updatedPromises, newFollowUps } = reconcilePromises(prev.promises, list);
      const brokenInstIds = new Set(newFollowUps.map((f) => f.installment_record_id));
      const installments = list.map((i) => (brokenInstIds.has(i.recordId) ? { ...i, next_follow_up_date: todayISO() } : i));

      const importLog = {
        id: uid(),
        file_name: fileName,
        uploaded_by: currentUser.id,
        uploaded_at: nowIso(),
        total_rows: totalRows,
        inserted_rows: inserted,
        updated_rows: updated,
        new_payments: newPayments.length,
        failed_rows: errors,
        status: errors > 0 ? "با خطا" : "موفق",
      };
      localResult = { totalRows, inserted, updated, errors, newPayments: newPayments.length };

      return {
        ...prev,
        installments,
        payments: [...prev.payments, ...newPayments],
        paymentAttributions: [...prev.paymentAttributions, ...newAttributions],
        promises: updatedPromises,
        followUps: [...prev.followUps, ...newFollowUps],
        importLogs: [importLog, ...prev.importLogs],
        savedMapping: mapping,
      };
    });
    setImportResult(localResult);
    setStep(4);
  }

  function reset() {
    setStep(1); setFileName(""); setCsvHeaders([]); setCsvRows([]); setMapping({}); setImportResult(null); setParseError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const logColumns = [
    { key: "file_name", header: "نام فایل", searchValue: (r) => r.file_name },
    { key: "uploaded_at", header: "تاریخ آپلود", render: (r) => fmtJalaliDateTime(r.uploaded_at) },
    { key: "uploaded_by", header: "آپلودکننده", render: (r) => state.users.find((u) => u.id === r.uploaded_by)?.name || "—" },
    { key: "total_rows", header: "تعداد رکورد", render: (r) => fmtNum(r.total_rows) },
    { key: "inserted_rows", header: "جدید", render: (r) => fmtNum(r.inserted_rows) },
    { key: "updated_rows", header: "به‌روزشده", render: (r) => fmtNum(r.updated_rows) },
    { key: "new_payments", header: "پرداخت جدید", render: (r) => fmtNum(r.new_payments) },
    { key: "failed_rows", header: "خطا", render: (r) => fmtNum(r.failed_rows) },
    { key: "status", header: "وضعیت", render: (r) => <Badge tone={r.status === "موفق" ? "green" : "amber"}>{r.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="همگام‌سازی اقساط" subtitle="فاز ۱: ورود اطلاعات از فایل CSV — بدون اتصال به دیتابیس یا API" />

      <Card>
        <div className="mb-5 flex items-center gap-2 text-[12px] text-gray-400">
          {["بارگذاری فایل", "نگاشت ستون‌ها", "پیش‌نمایش", "نتیجه"].map((label, idx) => (
            <React.Fragment key={label}>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${step === idx + 1 ? "bg-indigo-50 font-medium text-indigo-600" : step > idx + 1 ? "text-emerald-600" : ""}`}>
                {step > idx + 1 ? <CheckCircle2 size={13} /> : <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">{idx + 1}</span>}
                {label}
              </span>
              {idx < 3 && <span className="text-gray-200">—</span>}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${dragOver ? "border-indigo-400 bg-indigo-50/50" : "border-gray-200"}`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500"><UploadCloud size={26} /></div>
            <div>
              <p className="text-sm font-medium text-gray-700">فایل CSV را اینجا بکشید و رها کنید</p>
              <p className="mt-1 text-[12px] text-gray-400">یا از دستگاه خود انتخاب کنید</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            <PrimaryButton onClick={() => fileInputRef.current?.click()}><FileSpreadsheet size={15} /> آپلود فایل CSV</PrimaryButton>
            {parseError && <p className="text-[12px] text-rose-500">{parseError}</p>}
            <div className="mt-4 flex max-w-md items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-right text-[12px] text-amber-700">
              <Info size={15} className="mt-0.5 shrink-0" />
              <span>برای تشخیص خودکار Provider، ستون <b dir="ltr">provider_id</b> باید در خروجی کوئری شما وجود داشته باشد (در حال حاضر کوئری فقط در WHERE از آن استفاده می‌کند، در SELECT نیست).</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-4 text-[13px] text-gray-500">فایل <b>{fileName}</b> — {fmtNum(csvRows.length)} ردیف شناسایی شد. هر ستون CSV را به فیلد متناظر در برنامه نگاشت کنید.</p>
            <div className="max-h-96 space-y-2 overflow-y-auto pl-1">
              {csvHeaders.map((h) => (
                <div key={h} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2">
                  <span className="w-1/2 truncate text-[13px] font-medium text-gray-600" dir="ltr">{h}</span>
                  <ChevronDown size={14} className="shrink-0 text-gray-300" />
                  <TSelect value={mapping[h] || "__ignore__"} onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))} className="!w-1/2">
                    {APP_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </TSelect>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 rounded-xl bg-gray-50 p-3 text-[12px]">
              <p className={canIdentifyRows ? "text-emerald-600" : "text-rose-600"}>
                {canIdentifyRows ? "✓ کلید شناسایی رکورد آماده است" : "✕ برای شناسایی رکورد، حداقل «کد ملی + Loan ID + شماره قسط» یا Installment ID را نگاشت کنید."}
              </p>
              <p className={hasQueueFields ? "text-emerald-600" : "text-amber-600"}>
                {hasQueueFields ? "✓ تاریخ سررسید و Status برای صف پیگیری آماده است" : "⚠ برای اینکه پیگیری سررسیدها درست کار کند، Due Date و Status را هم نگاشت کنید."}
              </p>
            </div>
            <div className="mt-5 flex justify-between">
              <GhostButton onClick={reset}>انصراف</GhostButton>
              <PrimaryButton disabled={!canIdentifyRows} onClick={() => setStep(3)}>ادامه به پیش‌نمایش</PrimaryButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="mb-4 text-[13px] text-gray-500">پیش‌نمایش ۵ ردیف اول پس از نگاشت:</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full min-w-[600px] text-[12px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>{APP_FIELDS.filter((f) => f.key !== "__ignore__" && Object.values(mapping).includes(f.key)).map((f) => <th key={f.key} className="whitespace-nowrap px-3 py-2 text-right font-medium">{f.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {csvRows.slice(0, 5).map((row, idx) => {
                    const mapped = applyMapping(row, mapping);
                    const fields = APP_FIELDS.filter((f) => f.key !== "__ignore__" && Object.values(mapping).includes(f.key));
                    return (
                      <tr key={idx}>
                        {fields.map((f) => <td key={f.key} className="whitespace-nowrap px-3 py-2 text-gray-600">{mapped[f.key] ?? "—"}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex justify-between">
              <GhostButton onClick={() => setStep(2)}>بازگشت</GhostButton>
              <PrimaryButton onClick={confirmImport}><UploadCloud size={15} /> تایید و اجرای Import</PrimaryButton>
            </div>
          </div>
        )}

        {step === 4 && importResult && (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <KpiCard icon={FileSpreadsheet} label="رکورد خوانده‌شده" value={fmtNum(importResult.totalRows)} tone="indigo" />
              <KpiCard icon={Plus} label="رکورد جدید" value={fmtNum(importResult.inserted)} tone="emerald" />
              <KpiCard icon={RefreshCw} label="رکورد به‌روزشده" value={fmtNum(importResult.updated)} tone="amber" />
              <KpiCard icon={Coins} label="پرداخت جدید شناسایی‌شده" value={fmtNum(importResult.newPayments)} tone="emerald" />
              <KpiCard icon={AlertTriangle} label="رکورد خطادار" value={fmtNum(importResult.errors)} tone="rose" />
            </div>
            <div className="mt-5">
              <PrimaryButton onClick={reset}><UploadCloud size={15} /> آپلود فایل جدید</PrimaryButton>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-5">
        <p className="mb-3 text-sm font-bold text-gray-700">تاریخچه آپلود فایل</p>
        <DataTable columns={logColumns} rows={state.importLogs} rowKey={(r) => r.id} searchable={false} emptyTitle="هنوز فایلی آپلود نشده است" />
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: USERS
   ============================================================ */

function UsersPage({ state, updateState }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", mobile: "", email: "", role: "agent", status: "active" });

  function openNew() { setEditing(null); setForm({ name: "", mobile: "", email: "", role: "agent", status: "active" }); setModalOpen(true); }
  function openEdit(u) { setEditing(u); setForm({ name: u.name, mobile: u.mobile, email: u.email, role: u.role, status: u.status }); setModalOpen(true); }

  function save() {
    if (!form.name || !form.mobile) return;
    updateState((prev) => {
      if (editing) {
        return { ...prev, users: prev.users.map((u) => (u.id === editing.id ? { ...u, ...form } : u)) };
      }
      return { ...prev, users: [...prev.users, { id: uid(), ...form, created_at: nowIso() }] };
    });
    setModalOpen(false);
  }

  function toggleStatus(u) {
    updateState((prev) => ({ ...prev, users: prev.users.map((x) => (x.id === u.id ? { ...x, status: x.status === "active" ? "inactive" : "active" } : x)) }));
  }

  const columns = [
    { key: "name", header: "نام", searchValue: (r) => r.name, render: (r) => r.name },
    { key: "mobile", header: "موبایل", searchValue: (r) => r.mobile },
    { key: "email", header: "ایمیل", searchValue: (r) => r.email },
    { key: "role", header: "نقش", render: (r) => <Badge tone={r.role === "admin" ? "violet" : r.role === "supervisor" ? "blue" : "gray"}>{ROLE_LABEL[r.role]}</Badge> },
    { key: "status", header: "وضعیت", render: (r) => <Badge tone={r.status === "active" ? "green" : "gray"}>{STATUS_LABEL[r.status]}</Badge> },
    { key: "actions", header: "عملیات", render: (r) => (
      <div className="flex gap-1.5">
        <GhostButton onClick={() => openEdit(r)} className="!px-2.5 !py-1.5"><Pencil size={13} /></GhostButton>
        <DangerGhostButton onClick={() => toggleStatus(r)}>{r.status === "active" ? "غیرفعال کردن" : "فعال کردن"}</DangerGhostButton>
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader title="کاربران / کارشناسان" subtitle="مدیریت ادمین، سرپرست و کارشناسان وصول" action={<PrimaryButton onClick={openNew}><Plus size={15} /> کاربر جدید</PrimaryButton>} />
      <DataTable columns={columns} rows={state.users} rowKey={(r) => r.id} searchPlaceholder="جستجوی نام یا موبایل..." />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "ویرایش کاربر" : "کاربر جدید"}>
        <Field label="نام" required><TInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="موبایل" required><TInput value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
        <Field label="ایمیل"><TInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="نقش">
          <TSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="agent">کارشناس</option>
            <option value="supervisor">سرپرست</option>
            <option value="admin">ادمین</option>
          </TSelect>
        </Field>
        <Field label="وضعیت">
          <TSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">فعال</option>
            <option value="inactive">غیرفعال</option>
          </TSelect>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton onClick={() => setModalOpen(false)}>انصراف</GhostButton>
          <PrimaryButton onClick={save}>ذخیره</PrimaryButton>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   PAGE: SETTINGS
   ============================================================ */

function SettingsPage({ state, updateState, onResetDemo }) {
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");

  function addProvider() {
    if (!providerId || !providerName) return;
    updateState((prev) => ({ ...prev, providerMap: { ...prev.providerMap, [providerId]: providerName } }));
    setProviderId(""); setProviderName("");
  }
  function removeProvider(id) {
    updateState((prev) => {
      const next = { ...prev.providerMap };
      delete next[id];
      return { ...prev, providerMap: next };
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="تنظیمات" subtitle="پیکربندی پروایدرها و نکات مربوط به فاز ۲" />

      <Card>
        <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-700"><Building2 size={15} /> نگاشت پروایدر (Provider ID)</p>
        <div className="space-y-2">
          {Object.entries(state.providerMap).map(([id, name]) => (
            <div key={id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-[13px]">
              <span className="text-gray-500">شناسه: <b className="text-gray-700">{id}</b> ← {name}</span>
              <DangerGhostButton onClick={() => removeProvider(id)}><Trash2 size={13} /></DangerGhostButton>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-28"><Field label="شناسه"><TInput value={providerId} onChange={(e) => setProviderId(e.target.value)} /></Field></div>
          <div className="w-48"><Field label="نام پروایدر"><TInput value={providerName} onChange={(e) => setProviderName(e.target.value)} /></Field></div>
          <PrimaryButton onClick={addProvider} className="mb-4"><Plus size={14} /> افزودن</PrimaryButton>
        </div>
      </Card>

      <Card>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-gray-700"><Info size={15} /> نکات فاز ۱ و ۲</p>
        <ul className="list-inside list-disc space-y-1.5 text-[13px] leading-6 text-gray-500">
          <li>ورود کاربران در این نسخه نمایشی است (بدون رمز عبور). احراز هویت امن نیازمند بک‌اند واقعی است و در فاز ۲ اضافه می‌شود.</li>
          <li>داده‌ها در حافظهٔ Artifact ذخیره می‌شوند و بین همهٔ افرادی که به این artifact دسترسی دارند مشترک است — نه یک دیتابیس مرکزی واقعی.</li>
          <li>لایهٔ Import طوری طراحی شده که در فاز ۲ بدون بازطراحی، جایگزین آن با دیتابیس مستقیم یا REST API ممکن باشد.</li>
        </ul>
      </Card>

      <Card>
        <p className="mb-2 text-sm font-bold text-gray-700">بازنشانی داده‌های نمایشی</p>
        <p className="mb-3 text-[12px] text-gray-400">همهٔ داده‌های فعلی حذف و داده‌های اولیهٔ نمایشی جایگزین می‌شود. برای شروع تست از ابتدا استفاده کنید.</p>
        <DangerGhostButton onClick={onResetDemo} className="!px-4 !py-2 !text-[13px]"><RefreshCw size={14} /> بازنشانی داده‌ها</DangerGhostButton>
      </Card>
    </div>
  );
}

/* ============================================================
   ROOT APP
   ============================================================ */

export default function App() {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [detailInstallment, setDetailInstallment] = useState(null);
  const [callModalInst, setCallModalInst] = useState(null);
  const [promiseModalInst, setPromiseModalInst] = useState(null);
  const [saveNotice, setSaveNotice] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      const loaded = await loadAppState();
      if (loaded) {
        setState(loaded);
      } else {
        const initial = buildInitialState();
        setState(initial);
        await saveAppState(initial);
      }
      setReady(true);
    })();
  }, []);

  const updateState = useCallback((patchFn) => {
    setState((prev) => {
      const next = typeof patchFn === "function" ? patchFn(prev) : patchFn;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const ok = await saveAppState(next);
        setSaveNotice(ok ? "" : "ذخیره‌سازی ناموفق بود — اتصال را بررسی کنید");
      }, 400);
      return next;
    });
  }, []);

  function resetDemo() {
    const initial = buildInitialState();
    setState(initial);
    saveAppState(initial);
  }

  const agents = useMemo(() => (state ? state.users.filter((u) => u.role === "agent" && u.status === "active") : []), [state]);

  const scopeInstallments = useMemo(() => {
    if (!state || !currentUser) return [];
    if (currentUser.role === "agent") return state.installments.filter((i) => i.assigned_agent_id === currentUser.id);
    return state.installments;
  }, [state, currentUser]);

  function openDetail(inst) { setDetailInstallment(inst); }
  function closeDetail() { setDetailInstallment(null); }

  function handleCallSubmit({ callResult, notes, nextDate }) {
    const inst = callModalInst;
    updateState((prev) => {
      const followUp = {
        id: uid(),
        installment_record_id: inst.recordId,
        agent_id: currentUser.id,
        contact_at: nowIso(),
        call_result: callResult,
        notes,
        next_follow_up_date: nextDate,
        created_at: nowIso(),
      };
      const installments = prev.installments.map((i) => i.recordId === inst.recordId ? {
        ...i,
        last_contact_at: followUp.contact_at,
        last_call_result: callResult,
        call_count: (i.call_count || 0) + 1,
        next_follow_up_date: nextDate || i.next_follow_up_date,
      } : i);
      return { ...prev, followUps: [...prev.followUps, followUp], installments };
    });
    setCallModalInst(null);
    if (callResult === "تعهد به پرداخت داد") {
      setTimeout(() => setPromiseModalInst(inst), 150);
    } else {
      setDetailInstallment(null);
    }
  }

  function handlePromiseSubmit({ amount, promiseDate, nextDate, notes }) {
    const inst = promiseModalInst;
    updateState((prev) => {
      const promise = {
        id: uid(),
        installment_record_id: inst.recordId,
        agent_id: currentUser.id,
        promise_amount: amount,
        promise_date: promiseDate,
        next_follow_up_date: nextDate,
        status: "فعال",
        notes,
        created_at: nowIso(),
        resolved_at: null,
      };
      const installments = prev.installments.map((i) => i.recordId === inst.recordId ? { ...i, active_promise_id: promise.id, next_follow_up_date: nextDate || i.next_follow_up_date } : i);
      return { ...prev, promises: [...prev.promises, promise], installments };
    });
    setPromiseModalInst(null);
    setDetailInstallment(null);
  }

  function handleReassign(inst, newAgentId) {
    updateState((prev) => {
      const assignment = {
        id: uid(),
        installment_record_id: inst.recordId,
        old_agent_id: inst.assigned_agent_id || null,
        new_agent_id: newAgentId,
        assigned_at: nowIso(),
        reassigned_at: inst.assigned_agent_id ? nowIso() : null,
        reason: "تغییر از پروندهٔ قسط",
      };
      const installments = prev.installments.map((i) => (i.recordId === inst.recordId ? { ...i, assigned_agent_id: newAgentId } : i));
      return { ...prev, installments, assignments: [...prev.assignments, assignment] };
    });
    setDetailInstallment((d) => (d ? { ...d, assigned_agent_id: newAgentId } : d));
  }

  if (!ready || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-400" dir="rtl">
        <RefreshCw size={20} className="animate-spin" />
        <span className="mr-2 text-sm">در حال بارگذاری...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen users={state.users} onLogin={setCurrentUser} />;
  }

  const can = { reassign: currentUser.role === "admin" || currentUser.role === "supervisor" };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 text-gray-800" style={{ fontFamily: "'Vazirmatn', Tahoma, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Vazirmatn', Tahoma, sans-serif; }
      `}</style>

      <div className="flex h-screen overflow-hidden">
        <aside className="hidden w-64 shrink-0 bg-[#14122b] md:flex">
          <SidebarContent page={page} setPage={setPage} role={currentUser.role} user={currentUser} onLogout={() => setCurrentUser(null)} />
        </aside>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div className="w-64 bg-[#14122b]">
              <SidebarContent page={page} setPage={setPage} role={currentUser.role} user={currentUser} onLogout={() => setCurrentUser(null)} onNavigate={() => setMobileNavOpen(false)} />
            </div>
            <div className="flex-1 bg-slate-900/50" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 md:hidden">
            <button onClick={() => setMobileNavOpen(true)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-50"><Menu size={20} /></button>
            <span className="text-sm font-bold text-gray-700">سامانه وصول مطالبات</span>
            <div className="w-9" />
          </header>

          {saveNotice && (
            <div className="flex items-center gap-1.5 bg-rose-50 px-4 py-1.5 text-[12px] text-rose-600">
              <AlertTriangle size={13} /> {saveNotice}
            </div>
          )}

          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            {page === "dashboard" && <DashboardPage state={state} currentUser={currentUser} scopeInstallments={scopeInstallments} />}
            {page === "today" && <TodayFollowupsPage state={state} currentUser={currentUser} scopeInstallments={scopeInstallments} agents={agents} openDetail={openDetail} />}
            {page === "installments" && <InstallmentsPage state={state} scopeInstallments={scopeInstallments} agents={agents} openDetail={openDetail} />}
            {page === "promises" && <PromisesPage state={state} scopeInstallments={scopeInstallments} agents={agents} openDetail={openDetail} />}
            {page === "next" && <NextFollowupsPage state={state} scopeInstallments={scopeInstallments} agents={agents} openDetail={openDetail} />}
            {page === "performance" && (currentUser.role !== "agent") && <AgentPerformancePage state={state} />}
            {page === "assignment" && (currentUser.role !== "agent") && <AssignmentPage state={state} updateState={updateState} agents={agents} currentUser={currentUser} />}
            {page === "sync" && currentUser.role === "admin" && <SyncPage state={state} updateState={updateState} currentUser={currentUser} />}
            {page === "users" && currentUser.role === "admin" && <UsersPage state={state} updateState={updateState} />}
            {page === "settings" && currentUser.role === "admin" && <SettingsPage state={state} updateState={updateState} onResetDemo={resetDemo} />}
          </main>
        </div>
      </div>

      {detailInstallment && (
        <InstallmentDetailDrawer
          installment={state.installments.find((i) => i.recordId === detailInstallment.recordId) || detailInstallment}
          onClose={closeDetail}
          agents={agents}
          currentUser={currentUser}
          can={can}
          state={state}
          onOpenCall={setCallModalInst}
          onOpenPromise={setPromiseModalInst}
          onReassign={handleReassign}
        />
      )}

      <CallResultModal open={!!callModalInst} onClose={() => setCallModalInst(null)} installment={callModalInst} currentUser={currentUser} onSubmit={handleCallSubmit} />
      <PromiseModal open={!!promiseModalInst} onClose={() => setPromiseModalInst(null)} installment={promiseModalInst} onSubmit={handlePromiseSubmit} />
    </div>
  );
}
