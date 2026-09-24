import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Format a YYYY-MM-DD date string into concise human-readable date.
 */
function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    return dt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch (_) {
    return dateStr;
  }
}

/**
 * Export customized schedule data to a professional PDF document.
 * 
 * Supports dynamic column selection, landscape/portrait orientation,
 * executive summary statistics box, and municipal color coding.
 */
export function exportScheduleToPdf(items, {
  title = 'Nagarsevak Daily Schedule & Action Plan Report',
  scope = 'All Municipal Wards',
  filterLabel = "Today's Agenda",
  nagarName = '',
  columns = {
    date: true,
    time: true,
    title: true,
    notes: true,
    category: true,
    priority: true,
    location: true,
    status: true,
    creator: true,
    completion: true,
  },
  orientation = 'landscape',
  includeStats = true,
  periodType = 'report',
} = {}) {
  const isLandscape = orientation === 'landscape';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const contentWidth = pageWidth - 28; // 14mm margins on left & right

  // Top header banner - Municipal deep navy
  doc.setFillColor(15, 43, 92); // #0f2b5c
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('WardDesk · Nagarsevak Daily Schedule & Action Plan', 14, 10);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const generatedAt = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  doc.text(`Generated: ${generatedAt} IST  |  Scope: ${scope}${nagarName ? `  |  Nagarsevak: ${nagarName}` : ''}`, 14, 18);

  // Calculate live statistics
  const totalCount = items?.length || 0;
  const completedCount = items?.filter(it => it.status === 'COMPLETED').length || 0;
  const pendingCount = totalCount - completedCount;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Sub-header summary block
  let currentY = 28;
  const subheaderHeight = includeStats ? 16 : 12;

  doc.setFillColor(248, 250, 252);
  doc.rect(14, currentY, contentWidth, subheaderHeight, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, currentY, contentWidth, subheaderHeight, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Report Subject: ${filterLabel}`, 18, currentY + (includeStats ? 7 : 8));

  if (includeStats) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Tasks: ${totalCount}   |   Done: ${completedCount}   |   Pending: ${pendingCount}   |   Completion Rate: ${completionRate}%`, 18, currentY + 12.5);
  }

  // Define column definitions with relative weights
  const colDefs = [
    { key: 'index', title: '#', weight: 9, halign: 'center', always: true },
    { key: 'date', title: 'Date', weight: 22, halign: 'left', enabled: columns.date },
    { key: 'time', title: 'Time', weight: 18, halign: 'left', enabled: columns.time },
    { key: 'title', title: 'Work Agenda & Action Items', weight: 65, halign: 'left', enabled: columns.title !== false },
    { key: 'category', title: 'Nature of Work', weight: 26, halign: 'left', enabled: columns.category },
    { key: 'priority', title: 'Priority', weight: 18, halign: 'center', enabled: columns.priority },
    { key: 'location', title: 'Location / Area', weight: 32, halign: 'left', enabled: columns.location },
    { key: 'status', title: 'Status', weight: 22, halign: 'center', enabled: columns.status },
    { key: 'creator', title: 'Added By', weight: 24, halign: 'left', enabled: columns.creator },
    { key: 'assigned', title: 'Assigned To', weight: 24, halign: 'left', enabled: columns.assigned !== false },
    { key: 'completion', title: 'Completion Details', weight: 30, halign: 'left', enabled: columns.completion },
  ];

  const activeCols = colDefs.filter(c => c.always || c.enabled);

  // Compute proportional widths to exactly fill available content width
  const totalWeight = activeCols.reduce((sum, c) => sum + c.weight, 0);
  const columnStyles = {};

  activeCols.forEach((col, idx) => {
    const width = Math.floor((col.weight / totalWeight) * contentWidth);
    columnStyles[idx] = {
      cellWidth: width,
      halign: col.halign || 'left'
    };
  });

  const head = [activeCols.map(c => c.title)];

  // Build row data
  const body = (items || []).map((it, idx) => {
    const isDone = it.status === 'COMPLETED';
    const isSelf = it.creator?.role?.name === 'NAGARSEVAK' || it.createdByUserId === it.nagarsevakUserId;
    const addedByStr = isSelf ? 'Self (Nagarsevak)' : `Staff (${it.creator?.name || 'Employee'})`;

    let completionStr = '—';
    if (isDone) {
      const timePart = it.completedAt
        ? new Date(it.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';
      const byPart = it.completedBy?.name ? `by ${it.completedBy.name}` : '';
      completionStr = `Done ${timePart} ${byPart}`.trim();
      if (it.completionNote) {
        completionStr += `\n"${it.completionNote}"`;
      }
    }

    let titleAndNotes = it.title || '';
    if (columns.notes && it.description) {
      titleAndNotes += `\nNotes: ${it.description}`;
    }

    const row = [];
    activeCols.forEach(c => {
      switch (c.key) {
        case 'index':
          row.push(idx + 1);
          break;
        case 'date':
          row.push(formatShortDate(it.scheduledDate));
          break;
        case 'time':
          row.push(it.scheduledTime || '—');
          break;
        case 'title':
          row.push(titleAndNotes);
          break;
        case 'category':
          row.push(it.category ? it.category.replaceAll('_', ' ') : 'VISIT');
          break;
        case 'priority':
          row.push(it.priority || 'MEDIUM');
          break;
        case 'location':
          row.push(it.location || '—');
          break;
        case 'status':
          row.push(isDone ? 'COMPLETED' : it.status === 'IN_PROGRESS' ? 'IN PROGRESS' : 'PENDING');
          break;
        case 'creator':
          row.push(addedByStr);
          break;
        case 'assigned':
          row.push(it.assignedEmployee?.name || '—');
          break;
        case 'completion':
          row.push(completionStr);
          break;
        default:
          row.push('—');
      }
    });

    return row;
  });

  const emptyRow = activeCols.map((c, i) => i === 0 ? '—' : i === 1 ? 'No schedule tasks found matching this criteria.' : '');

  // Render Table
  autoTable(doc, {
    startY: currentY + subheaderHeight + 4,
    head,
    body: body.length ? body : [emptyRow],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 43, 92],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: isLandscape ? 8.5 : 8,
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: isLandscape ? 8 : 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section === 'body') {
        const colDef = activeCols[data.column.index];
        if (colDef?.key === 'status') {
          if (data.cell.raw === 'COMPLETED') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'PENDING' || data.cell.raw === 'IN PROGRESS') {
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (colDef?.key === 'priority') {
          if (data.cell.raw === 'URGENT') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.raw === 'HIGH') {
            data.cell.styles.textColor = [234, 88, 12];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  // Footer page numbers on all pages
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} · Official Municipal WardDesk Management System · Ahilyanagar`,
      14,
      pageHeight - 8
    );
  }

  const safePeriod = String(periodType || 'report').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`Nagarsevak-Schedule-${safePeriod}-${safeDate}.pdf`);
}
