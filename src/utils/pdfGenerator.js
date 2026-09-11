import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates and downloads a clean 1-Page PDF report for an individual team
 * @param {Object} team - Team object with name, leader, members, budget, players, etc.
 */
export function downloadTeamReportPDF(team) {
  if (!team) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const wonItems = team.players || [];
  const pointsSpent = wonItems.reduce((sum, item) => sum + (item.soldPrice || item.basePrice || 0), 0);
  const remainingBudget = team.budget ?? 250;
  const initialBudget = remainingBudget + pointsSpent;
  const members = team.members || [team.leader || 'Leader'];

  // Top Dark Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Top Accent Line
  doc.setFillColor(0, 229, 255); // cyan-400
  doc.rect(0, 31, pageWidth, 1.5, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 229, 255);
  doc.text('ELECTRONIC ARENA', margin, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Digital Logic Circuit Auction • Team Evaluation Report', margin, 21);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  const dateStr = new Date().toLocaleString();
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Status: ${team.verified ? 'Approved Team' : 'Registered Team'}`, pageWidth - margin, 21, { align: 'right' });

  // 1. Team Profile & Roster Box
  let yPos = 40;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(team.name.toUpperCase(), margin + 5, yPos + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Team Leader: `, margin + 5, yPos + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(team.leader || members[0] || 'Leader', margin + 28, yPos + 15);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Team Roster (${members.length} members): `, margin + 5, yPos + 22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(members.join(', '), margin + 50, yPos + 22);

  // 2. Financial & Budget Summary Cards (3 Columns)
  yPos += 33;
  const colWidth = (pageWidth - margin * 2 - 8) / 3;

  // Card 1: Starting Budget
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, yPos, colWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('INITIAL BUDGET', margin + 4, yPos + 6);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`${initialBudget} pts`, margin + 4, yPos + 15);

  // Card 2: Points Spent
  doc.setFillColor(254, 242, 242); // rose-50
  doc.roundedRect(margin + colWidth + 4, yPos, colWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text('TOTAL SPENT', margin + colWidth + 8, yPos + 6);
  doc.setFontSize(14);
  doc.setTextColor(190, 18, 60);
  doc.text(`${pointsSpent} pts`, margin + colWidth + 8, yPos + 15);

  // Card 3: Remaining Balance
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.roundedRect(margin + (colWidth + 4) * 2, yPos, colWidth, 20, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text('REMAINING BALANCE', margin + (colWidth + 4) * 2 + 4, yPos + 6);
  doc.setFontSize(14);
  doc.setTextColor(21, 128, 61);
  doc.text(`${remainingBudget} pts`, margin + (colWidth + 4) * 2 + 4, yPos + 15);

  // 3. Components Inventory Table
  yPos += 27;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`ACQUIRED COMPONENTS INVENTORY (${wonItems.length} Items)`, margin, yPos);

  if (wonItems.length === 0) {
    yPos += 5;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 25, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('No components acquired during this auction stage.', pageWidth / 2, yPos + 14, { align: 'center' });
  } else {
    const tableData = wonItems.map((item, index) => [
      index + 1,
      `#${item.id}`,
      item.name,
      item.symbol || '—',
      item.role || 'Logic',
      `${item.soldPrice || item.basePrice} pts`,
    ]);

    autoTable(doc, {
      startY: yPos + 3,
      margin: { left: margin, right: margin },
      head: [['#', 'ID', 'Component Name', 'Symbol', 'Role / Classification', 'Purchase Price']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 'auto', fontStyle: 'bold' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 42 },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
      },
      foot: [
        ['', '', 'TOTAL INVENTORY VALUE', '', `${wonItems.length} items`, `${pointsSpent} pts`]
      ],
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: 2.5,
      }
    });
  }

  // Footer on bottom of page
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Electronic Arena • Official Automated Hardware Auction Record',
    margin,
    pageHeight - 8
  );
  doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - 8, { align: 'right' });

  // Save PDF
  const cleanFilename = `${team.name.replace(/[^a-zA-Z0-9]/g, '_')}_Auction_Report.pdf`;
  doc.save(cleanFilename);
}

/**
 * Generates and downloads an Overall Master PDF report for all teams
 * @param {Array} teamList - List of all teams
 * @param {Array} soldHistory - List of all sold events
 * @param {Array} unsoldPlayers - List of all unsold components
 */
export function downloadAllTeamsPDF(teamList, soldHistory = [], unsoldPlayers = []) {
  if (!teamList || teamList.length === 0) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // PAGE 1: OVERALL STANDINGS SUMMARY
  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setFillColor(0, 229, 255);
  doc.rect(0, 31, pageWidth, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 229, 255);
  doc.text('ELECTRONIC ARENA', margin, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Master Tournament & Team Standings Summary', margin, 21);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Total Teams: ${teamList.length}`, pageWidth - margin, 21, { align: 'right' });

  // Master Summary Table
  const sortedTeams = [...teamList].sort((a, b) => {
    const countA = (a.players || []).length;
    const countB = (b.players || []).length;
    if (countB !== countA) return countB - countA;
    return b.budget - a.budget;
  });

  const summaryData = sortedTeams.map((t, idx) => {
    const wonCount = (t.players || []).length;
    const spent = (t.players || []).reduce((sum, item) => sum + (item.soldPrice || item.basePrice || 0), 0);
    return [
      idx + 1,
      t.name,
      t.leader || (t.members && t.members[0]) || 'Leader',
      (t.members || []).length,
      `${wonCount} items`,
      `${spent} pts`,
      `${t.budget} pts`,
    ];
  });

  autoTable(doc, {
    startY: 40,
    margin: { left: margin, right: margin },
    head: [['Rank', 'Team Name', 'Team Leader', 'Members', 'Components Won', 'Points Spent', 'Remaining Budget']],
    body: summaryData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 'auto', fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'center', fontStyle: 'bold', textColor: [2, 132, 199] },
      5: { cellWidth: 24, halign: 'right', textColor: [225, 29, 72] },
      6: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
    },
  });

  // Footer on page 1
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Electronic Arena • Master Standings Overview', margin, pageHeight - 8);
  doc.text('Page 1', pageWidth - margin, pageHeight - 8, { align: 'right' });

  // SUBSEQUENT PAGES: 1 Page Dedicated for each Team
  sortedTeams.forEach((team, teamIndex) => {
    doc.addPage();
    const currentPage = teamIndex + 2;

    const wonItems = team.players || [];
    const pointsSpent = wonItems.reduce((sum, item) => sum + (item.soldPrice || item.basePrice || 0), 0);
    const remainingBudget = team.budget ?? 250;
    const initialBudget = remainingBudget + pointsSpent;
    const members = team.members || [team.leader || 'Leader'];

    // Header Banner
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(0, 229, 255);
    doc.rect(0, 27, pageWidth, 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 229, 255);
    doc.text('ELECTRONIC ARENA', margin, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Individual Team Report • #${teamIndex + 1} ${team.name}`, margin, 19);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Rank: #${teamIndex + 1}`, pageWidth - margin, 12, { align: 'right' });
    doc.text(`PIN: ${team.password}`, pageWidth - margin, 19, { align: 'right' });

    // Team Profile
    let yPos = 34;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(team.name.toUpperCase(), margin + 4, yPos + 7);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Leader: `, margin + 4, yPos + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(team.leader || members[0] || 'Leader', margin + 18, yPos + 14);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Roster: `, margin + 4, yPos + 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(members.join(', '), margin + 18, yPos + 20);

    // Budget Cards
    yPos += 28;
    const colWidth = (pageWidth - margin * 2 - 8) / 3;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, yPos, colWidth, 16, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('INITIAL BUDGET', margin + 3, yPos + 5);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`${initialBudget} pts`, margin + 3, yPos + 12);

    doc.setFillColor(254, 242, 242);
    doc.roundedRect(margin + colWidth + 4, yPos, colWidth, 16, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(225, 29, 72);
    doc.text('TOTAL SPENT', margin + colWidth + 7, yPos + 5);
    doc.setFontSize(11);
    doc.setTextColor(190, 18, 60);
    doc.text(`${pointsSpent} pts`, margin + colWidth + 7, yPos + 12);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin + (colWidth + 4) * 2, yPos, colWidth, 16, 2, 2, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text('REMAINING BUDGET', margin + (colWidth + 4) * 2 + 3, yPos + 5);
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61);
    doc.text(`${remainingBudget} pts`, margin + (colWidth + 4) * 2 + 3, yPos + 12);

    // Inventory Table
    yPos += 22;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`COMPONENTS ACQUIRED (${wonItems.length} Items)`, margin, yPos);

    if (wonItems.length === 0) {
      yPos += 4;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 2, 2, 'F');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('No components acquired.', pageWidth / 2, yPos + 11, { align: 'center' });
    } else {
      const tableData = wonItems.map((item, index) => [
        index + 1,
        `#${item.id}`,
        item.name,
        item.symbol || '—',
        item.role || 'Logic',
        `${item.soldPrice || item.basePrice} pts`,
      ]);

      autoTable(doc, {
        startY: yPos + 2,
        margin: { left: margin, right: margin },
        head: [['#', 'ID', 'Component Name', 'Symbol', 'Role / Classification', 'Price Paid']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 14, halign: 'center' },
          2: { cellWidth: 'auto', fontStyle: 'bold' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 40 },
          5: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
        },
        foot: [
          ['', '', 'TOTAL INVENTORY VALUE', '', `${wonItems.length} items`, `${pointsSpent} pts`]
        ],
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 2,
        }
      });
    }

    // Page footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Electronic Arena • Team Report: ${team.name}`, margin, pageHeight - 8);
    doc.text(`Page ${currentPage}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  });

  // Save Master PDF
  doc.save(`Electronic_Arena_Overall_Report_${Date.now()}.pdf`);
}
