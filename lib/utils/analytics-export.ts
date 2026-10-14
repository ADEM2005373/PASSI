import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DailyAnalyticsItem, DashboardAnalyticsResponse } from "@/lib/actions/analytics";

export type AnalyticsExportInput = 
  | DashboardAnalyticsResponse 
  | DailyAnalyticsItem[]
  | {
      dailyData: DailyAnalyticsItem[];
      totalRevenue?: number;
      totalPasses?: number;
      startDate?: string;
      endDate?: string;
    };

/**
 * Normalizes input data into an array of items and summary totals
 */
function normalizeAnalyticsData(input: AnalyticsExportInput) {
  let items: DailyAnalyticsItem[] = [];
  let totalRevenue = 0;
  let totalPasses = 0;
  let startDate = "";
  let endDate = "";

  if (Array.isArray(input)) {
    items = input;
    totalRevenue = items.reduce((acc, it) => acc + (Number(it.dailyRevenue) || 0), 0);
    totalPasses = items.reduce((acc, it) => acc + (Number(it.passCount) || 0), 0);
    if (items.length > 0) {
      startDate = items[0].date;
      endDate = items[items.length - 1].date;
    }
  } else if (input && Array.isArray(input.dailyData)) {
    items = input.dailyData;
    totalRevenue = input.totalRevenue !== undefined 
      ? input.totalRevenue 
      : items.reduce((acc, it) => acc + (Number(it.dailyRevenue) || 0), 0);
    totalPasses = input.totalPasses !== undefined 
      ? input.totalPasses 
      : items.reduce((acc, it) => acc + (Number(it.passCount) || 0), 0);
    startDate = input.startDate || (items[0] ? items[0].date : "");
    endDate = input.endDate || (items[items.length - 1] ? items[items.length - 1].date : "");
  }

  return {
    items,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalPasses,
    startDate,
    endDate
  };
}

/**
 * Client Utility: generateCSVReport
 * Formats daily analytics data into CSV and triggers browser download.
 * File: rapport_analytique_passi.csv
 */
export function generateCSVReport(input: AnalyticsExportInput): void {
  const { items } = normalizeAnalyticsData(input);

  if (!items || items.length === 0) {
    alert("Aucune donnée analytique disponible à exporter.");
    return;
  }

  // Headers specified in directive:
  // Date, Passes Vendus, Tendance (Volume), Chiffre d'Affaires (TND), Tendance (Revenus)
  const headers = [
    "Date",
    "Passes Vendus",
    "Tendance (Volume)",
    "Chiffre d'Affaires (TND)",
    "Tendance (Revenus)"
  ];

  const escapeCSV = (str: any) => {
    const val = String(str ?? '');
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = items.map(item => [
    escapeCSV(item.date),
    escapeCSV(item.passCount),
    escapeCSV(item.volumeTrend),
    escapeCSV(item.dailyRevenue.toFixed(2)),
    escapeCSV(item.revenueTrend)
  ]);

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  const csvContent = "\uFEFF" + [
    headers.map(escapeCSV).join(","),
    ...rows.map(r => r.join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "rapport_analytique_passi.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Client Utility: generatePDFReport
 * Generates an analytical PDF report using jsPDF and jspdf-autotable.
 * Includes executive summary & styled table with trend indicators.
 */
export function generatePDFReport(input: AnalyticsExportInput): void {
  const { items, totalRevenue, totalPasses, startDate, endDate } = normalizeAnalyticsData(input);

  if (!items || items.length === 0) {
    alert("Aucune donnée analytique disponible à exporter.");
    return;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // 1. Header & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(26, 35, 51); // Dark navy
  doc.text("Rapport Analytique d'Activité - Passi", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 135);
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`;
  doc.text(`Généré le ${dateStr} | Plateforme Officielle Passi`, 14, 26);

  // 2. Executive Summary Cards (Background block)
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 32, 182, 24, 3, 3, "F");

  // Total Revenue Block
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("CHIFFRE D'AFFAIRES GLOBAL", 20, 40);
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`${totalRevenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TND`, 20, 50);

  // Total Passes Sold Block
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL PASSES VENDUS", 85, 40);
  doc.setFontSize(14);
  doc.setTextColor(255, 107, 94); // Passi Corail
  doc.text(`${totalPasses} passes`, 85, 50);

  // Period Block
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("PÉRIODE COUVERTE", 145, 40);
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  const periodLabel = startDate && endDate ? `${startDate} au ${endDate}` : `${items.length} jours`;
  doc.text(periodLabel, 145, 49);

  // 3. AutoTable Content
  const tableRows = items.map(item => [
    item.date,
    `${item.passCount}`,
    item.volumeTrend,
    `${item.dailyRevenue.toFixed(2)} TND`,
    item.revenueTrend
  ]);

  autoTable(doc, {
    startY: 63,
    head: [["Date", "Passes Vendus", "Tendance (Volume)", "Chiffre d'Affaires (TND)", "Tendance (Revenus)"]],
    body: tableRows,
    foot: [["Total Période", `${totalPasses} passes`, "-", `${totalRevenue.toFixed(2)} TND`, "-"]],
    theme: "striped",
    headStyles: {
      fillColor: [26, 35, 51], // Passi dark navy header
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "left"
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85]
    },
    footStyles: {
      fillColor: [238, 242, 246],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 9
    },
    alternateRowStyles: {
      fillColor: [249, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 40 },
      3: { cellWidth: 42, halign: "right" },
      4: { cellWidth: 38 }
    },
    margin: { left: 14, right: 14 }
  });

  // 4. Save and trigger download
  doc.save("rapport_analytique_passi.pdf");
}
