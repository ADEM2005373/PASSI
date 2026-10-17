import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Pass } from "@/lib/services/api";

export interface DrinkReportRow {
  drinkName: string;
  aromasDisplay: string;
  count: number;
}

export interface DrinkReportData {
  rows: DrinkReportRow[];
  totalDrinks: number;
}

/**
 * Utility: aggregateDrinksReportData
 * Groups drinks by both drink name AND selected aromas.
 * If multiple users order the same drink with the exact same aromas, increments quantity.
 * If aromas differ, creates a distinct row.
 */
export function aggregateDrinksReportData(
  passes: Pass[],
  eventId: string
): DrinkReportData {
  // 1. Filter passes for this specific event that have selected a drink and are not rejected/declined
  const eventPasses = passes.filter(p => {
    if (p.event_id !== eventId) return false;
    const isRejected =
      p.entry_status === 'rejected' ||
      (p as any).status === 'REJECTED' ||
      p.invitation_status === 'DECLINED';
    if (isRejected) return false;

    return Boolean(p.drink_name || p.drink_menus?.name || p.drink_id);
  });

  const drinkGroups = new Map<string, DrinkReportRow>();
  let totalDrinks = 0;

  // 2. Iterate and group by drink_name + selected_aromas
  eventPasses.forEach(p => {
    const rawDrinkName = (p.drink_name || p.drink_menus?.name || p.drink_id || '').trim();
    if (!rawDrinkName) return;

    let aromasList: string[] = [];
    const rawAromas: any = (p as any).selected_aromas;
    if (Array.isArray(rawAromas)) {
      aromasList = rawAromas
        .filter((a: any) => typeof a === 'string' && a.trim().length > 0)
        .map((a: string) => a.trim());
    } else if (typeof rawAromas === 'string' && rawAromas.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawAromas);
        if (Array.isArray(parsed)) {
          aromasList = parsed
            .filter((a: any) => typeof a === 'string' && a.trim().length > 0)
            .map((a: string) => a.trim());
        } else {
          aromasList = [rawAromas.trim()];
        }
      } catch {
        aromasList = [rawAromas.trim()];
      }
    }

    // Sort aromas alphabetically for deterministic grouping
    const sortedAromas = [...aromasList].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' })
    );

    // Composite grouping key: drink name + sorted aromas
    const groupKey = `${rawDrinkName.toLowerCase()}:::${sortedAromas.map(a => a.toLowerCase()).join('|||')}`;
    const aromasDisplay = aromasList.length > 0 ? aromasList.join(', ') : '-';

    if (drinkGroups.has(groupKey)) {
      drinkGroups.get(groupKey)!.count += 1;
    } else {
      drinkGroups.set(groupKey, {
        drinkName: rawDrinkName,
        aromasDisplay,
        count: 1,
      });
    }

    totalDrinks += 1;
  });

  // 3. Sort rows: primary by drink name, secondary by aromas
  const rows = Array.from(drinkGroups.values()).sort((a, b) => {
    const nameCmp = a.drinkName.localeCompare(b.drinkName, 'fr', { sensitivity: 'base' });
    if (nameCmp !== 0) return nameCmp;
    return a.aromasDisplay.localeCompare(b.aromasDisplay, 'fr', { sensitivity: 'base' });
  });

  return { rows, totalDrinks };
}

/**
 * Utility: generateDrinksReportPDF
 * Generates and downloads the official Event Drinks Report PDF using jsPDF and jspdf-autotable.
 * Displays columns: 'Boisson' | 'Arômes / Goûts' | 'Quantité'.
 */
export function generateDrinksReportPDF(
  eventTitle: string,
  rows: DrinkReportRow[],
  totalDrinks: number
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 1. Header & Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(26, 35, 51); // Dark navy
  doc.text(`Rapport des boissons: ${eventTitle}`, 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(`Généré le ${dateStr} | Plateforme Officielle Passi — Préparation Bar & Logistique`, 14, 26);

  // 2. Summary Badge in PDF
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 30, 182, 16, 2.5, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("TOTAL CONSOMMATIONS RÉSERVÉES :", 20, 40);

  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`${totalDrinks} boisson${totalDrinks > 1 ? 's' : ''}`, 95, 40);

  // 3. Table Rows Data
  let tableData: (string | number)[][] = rows.map(r => [
    r.drinkName,
    r.aromasDisplay,
    r.count,
  ]);

  if (tableData.length === 0) {
    tableData = [['Aucune boisson réservée', '-', 0]];
  }

  // 4. Render Table with jspdf-autotable
  autoTable(doc, {
    startY: 52,
    head: [['Boisson', 'Arômes / Goûts', 'Quantité']],
    body: tableData,
    foot: [['Total', '', totalDrinks]],
    theme: 'striped',
    headStyles: {
      fillColor: [26, 35, 51], // Dark navy header
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    footStyles: {
      fillColor: [238, 242, 246],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 80 },
      2: { cellWidth: 32, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // 5. Download File
  doc.save(`boissons_${eventTitle.replace(/\s+/g, '_')}.pdf`);
}
