// public/validation-protocol/pdf-renderer.js
// Item 14b — Client-side PDF Renderer
// Called by the VPG ready screen "Generate PDF" button.
// Loads jsPDF from CDN, calls /api/generate-protocol, renders the 7-section document.
//
// Usage: import { generateProtocolPDF } from './pdf-renderer.js';
// Then: await generateProtocolPDF(state);  // state = { answers, logicFlags, gapFlags, documents }

// ─── CDN loader ───────────────────────────────────────────────────────────────

async function loadJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => {
      if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
      else reject(new Error("jsPDF loaded but constructor not found"));
    };
    script.onerror = () => reject(new Error("Failed to load jsPDF from CDN"));
    document.head.appendChild(script);
  });
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateProtocolPDF(state, onProgress) {
  const progress = onProgress || (() => {});

  progress("Calling governance engines...");

  // Call the orchestrator
  const response = await fetch("/api/generate-protocol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      answers: state.answers || {},
      logicFlags: state.logicFlags || [],
      gapFlags: state.gapFlags || [],
      documentMeta: (state.documents || []).map((d) => ({
        name: d.name,
        type: d.type,
        size: d.size ? `${Math.round(d.size / 1024)}KB` : null,
        pages: d.pages || null,
        phiResult: d.phiResult || null,
      })),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Protocol generation failed");
  }

  const { protocol } = await response.json();

  progress("Loading PDF renderer...");
  const JsPDF = await loadJsPDF();

  progress("Rendering document...");
  const pdf = await renderProtocolPDF(JsPDF, protocol);

  progress("Finalizing...");
  const filename = `validation-protocol-${slugify(protocol.meta.deploymentName)}-${formatDateShort(new Date())}.pdf`;
  pdf.save(filename);

  progress("Done.");
  return filename;
}

// ─── PDF renderer ─────────────────────────────────────────────────────────────

async function renderProtocolPDF(JsPDF, protocol) {
  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

  const ctx = new RenderContext(doc, protocol);

  // Cover page
  renderCoverPage(ctx);

  // Table of contents
  ctx.addPage();
  renderTableOfContents(ctx);

  // Sections 1–7
  for (const section of protocol.sections) {
    ctx.addPage();
    renderSection(ctx, section, protocol);
  }

  // Appendix: All gap flags consolidated
  if (protocol.allGapFlags?.length > 0) {
    ctx.addPage();
    renderGapFlagsAppendix(ctx, protocol);
  }

  // Apply page numbers to all pages
  applyPageNumbers(ctx);

  return doc;
}

// ─── Render context ───────────────────────────────────────────────────────────

class RenderContext {
  constructor(doc, protocol) {
    this.doc = doc;
    this.protocol = protocol;
    this.pageWidth = 612;   // letter width in pt
    this.pageHeight = 792;  // letter height in pt
    this.marginLeft = 54;
    this.marginRight = 54;
    this.marginTop = 54;
    this.marginBottom = 72;
    this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight;
    this.y = this.marginTop;
    this.pageNum = 1;
    this.totalPages = 0; // filled in at end
    this.pageRegistry = []; // [{pageNum, y, label}] for TOC

    // Color palette — earthy, grounded, not sterile
    this.colors = {
      purple:     [88, 44, 130],
      teal:       [32, 120, 110],
      charcoal:   [42, 42, 42],
      midGray:    [100, 100, 100],
      lightGray:  [220, 220, 220],
      paleGray:   [245, 245, 243],
      white:      [255, 255, 255],
      red:        [160, 40, 40],
      amber:      [180, 120, 20],
      green:      [35, 100, 65],
      redBg:      [253, 232, 232],
      amberBg:    [255, 243, 205],
      greenBg:    [216, 243, 220],
      grayBg:     [242, 242, 242],
    };

    this.fonts = {
      title: { size: 22, style: "bold" },
      sectionHeader: { size: 14, style: "bold" },
      subsectionHeader: { size: 11, style: "bold" },
      body: { size: 9, style: "normal" },
      small: { size: 8, style: "normal" },
      label: { size: 8, style: "bold" },
      caption: { size: 7, style: "italic" },
    };
  }

  get x() { return this.marginLeft; }

  addPage() {
    this.doc.addPage();
    this.pageNum++;
    this.y = this.marginTop;
    this.addPageHeader();
  }

  addPageHeader() {
    const { doc, colors, pageWidth, marginLeft, marginRight } = this;
    // Thin purple rule at top
    doc.setDrawColor(...colors.purple);
    doc.setLineWidth(1.5);
    doc.line(marginLeft, 28, pageWidth - marginRight, 28);

    // Commons identifier, small
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.midGray);
    doc.text("Healthcare Governance Commons — Validation Protocol", marginLeft, 22);
    doc.text(`${this.protocol.meta.deploymentName}`, pageWidth - marginRight, 22, { align: "right" });

    this.y = 50;
  }

  needsPage(height) {
    if (this.y + height > this.pageHeight - this.marginBottom) {
      this.addPage();
      return true;
    }
    return false;
  }

  setFont(type) {
    const f = this.fonts[type] || this.fonts.body;
    this.doc.setFont("helvetica", f.style);
    this.doc.setFontSize(f.size);
  }

  setColor(color) {
    if (Array.isArray(color)) {
      this.doc.setTextColor(...color);
    } else {
      this.doc.setTextColor(...(this.colors[color] || this.colors.charcoal));
    }
  }

  text(str, x, y, opts) {
    this.doc.text(String(str || ""), x, y, opts);
  }

  wrappedText(str, x, y, maxWidth, lineHeight) {
    if (!str) return y;
    this.doc.setFontSize(this.doc.getFontSize());
    const lines = this.doc.splitTextToSize(String(str), maxWidth);
    this.doc.text(lines, x, y);
    return y + lines.length * lineHeight;
  }

  rect(x, y, w, h, fillColor, strokeColor) {
    if (fillColor) {
      this.doc.setFillColor(...fillColor);
      this.doc.rect(x, y, w, h, strokeColor ? "FD" : "F");
    }
    if (strokeColor && !fillColor) {
      this.doc.setDrawColor(...strokeColor);
      this.doc.rect(x, y, w, h, "S");
    }
  }

  hRule(y, color) {
    this.doc.setDrawColor(...(this.colors[color] || this.colors.lightGray));
    this.doc.setLineWidth(0.5);
    this.doc.line(this.marginLeft, y, this.pageWidth - this.marginRight, y);
  }

  registerTOC(label, pageNum, y) {
    this.pageRegistry.push({ label, pageNum, y });
  }
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function renderCoverPage(ctx) {
  const { doc, colors, pageWidth, pageHeight } = ctx;
  const meta = ctx.protocol.meta;

  // Full-page background
  ctx.rect(0, 0, pageWidth, pageHeight, colors.paleGray);

  // Top accent bar
  ctx.rect(0, 0, pageWidth, 8, colors.purple);

  // Commons wordmark area
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.midGray);
  doc.text("Healthcare Governance Commons", ctx.marginLeft, 40);

  // Title block
  const titleY = 180;
  ctx.rect(ctx.marginLeft, titleY - 10, ctx.contentWidth, 100, colors.white);
  ctx.rect(ctx.marginLeft, titleY - 10, 4, 100, colors.purple); // left accent

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...colors.charcoal);
  const titleLines = doc.splitTextToSize("Validation Protocol", ctx.contentWidth - 24);
  doc.text(titleLines, ctx.marginLeft + 16, titleY + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...colors.purple);
  const nameLines = doc.splitTextToSize(meta.deploymentName, ctx.contentWidth - 24);
  doc.text(nameLines, ctx.marginLeft + 16, titleY + 36);

  // Protocol mode badge
  const badgeY = titleY + 62;
  const badgeColor = meta.isFullProtocol ? colors.teal : colors.amber;
  ctx.rect(ctx.marginLeft + 16, badgeY - 10, meta.isFullProtocol ? 130 : 150, 16, badgeColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.white);
  doc.text(meta.protocolMode.toUpperCase(), ctx.marginLeft + 22, badgeY + 1);

  // Metadata block
  const metaY = 320;
  const metaItems = [
    ["Institution", meta.institution],
    ["Use Type", meta.useType],
    ["Generated", meta.generatedDate],
    ["Protocol Version", meta.version],
    ["Protocol Mode", meta.protocolMode],
  ];

  doc.setFont("helvetica", "normal");
  for (let i = 0; i < metaItems.length; i++) {
    const [label, value] = metaItems[i];
    const rowY = metaY + i * 22;
    ctx.rect(ctx.marginLeft, rowY - 9, ctx.contentWidth, 20, i % 2 === 0 ? colors.white : colors.paleGray);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.midGray);
    doc.text(label.toUpperCase(), ctx.marginLeft + 8, rowY + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.charcoal);
    doc.text(String(value || "—"), ctx.marginLeft + 130, rowY + 4);
  }

  // Overall rating badge
  const rating = ctx.protocol.overallRating;
  if (rating) {
    const ratingY = metaY + metaItems.length * 22 + 24;
    const ratingColors = {
      critical: { bg: colors.redBg, border: colors.red, text: colors.red },
      elevated: { bg: colors.amberBg, border: colors.amber, text: colors.amber },
      moderate: { bg: colors.amberBg, border: colors.amber, text: colors.amber },
      adequate: { bg: colors.greenBg, border: colors.green, text: colors.green },
      unknown: { bg: colors.grayBg, border: colors.midGray, text: colors.midGray },
    };
    const rc = ratingColors[rating.rating] || ratingColors.unknown;

    ctx.rect(ctx.marginLeft, ratingY, ctx.contentWidth, 50, rc.bg);
    doc.setDrawColor(...rc.border);
    doc.setLineWidth(1);
    doc.rect(ctx.marginLeft, ratingY, ctx.contentWidth, 50, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...rc.text);
    doc.text("OVERALL GOVERNANCE RATING", ctx.marginLeft + 10, ratingY + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(rating.label || "—", ctx.marginLeft + 10, ratingY + 30);

    if (rating.summary) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.charcoal);
      const summaryLines = doc.splitTextToSize(rating.summary, ctx.contentWidth - 20);
      if (summaryLines.length > 0) doc.text(summaryLines[0], ctx.marginLeft + 10, ratingY + 44);
    }
  }

  // Shelf life statement at bottom
  const shelfY = pageHeight - 80;
  ctx.hRule(shelfY - 8, "lightGray");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.midGray);
  const shelfLines = doc.splitTextToSize(meta.shelfLifeStatement, ctx.contentWidth);
  doc.text(shelfLines, ctx.marginLeft, shelfY);

  // Bottom bar
  ctx.rect(0, pageHeight - 8, pageWidth, 8, colors.teal);
}

// ─── Table of contents ────────────────────────────────────────────────────────

function renderTableOfContents(ctx) {
  const { doc, colors } = ctx;
  ctx.addPageHeader();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...colors.charcoal);
  doc.text("Contents", ctx.marginLeft, ctx.y + 4);
  ctx.y += 24;

  ctx.hRule(ctx.y, "lightGray");
  ctx.y += 14;

  const tocItems = [
    { label: "Section 1 — Deployment Context & Scope", page: 3 },
    { label: "Section 2 — Model Characterization & Performance Baseline", page: 4 },
    { label: "Section 3 — Bias & Fairness Assessment", page: 5 },
    { label: "Section 4 — Monitoring Framework & Tier Thresholds", page: 6 },
    { label: "Section 5 — Governance Node Assessment", page: 7 },
    { label: "Section 6 — Implementation Readiness & Deployment Conditions", page: 8 },
    { label: "Section 7 — Governance Summary & Open Items", page: 9 },
  ];

  if (ctx.protocol.allGapFlags?.length > 0) {
    tocItems.push({ label: "Appendix — Consolidated Gap Flags", page: 10 });
  }

  for (const item of tocItems) {
    ctx.needsPage(22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.charcoal);
    doc.text(item.label, ctx.marginLeft, ctx.y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.midGray);
    doc.text(String(item.page), ctx.pageWidth - ctx.marginRight, ctx.y, { align: "right" });

    // Dot leader
    doc.setDrawColor(...colors.lightGray);
    doc.setLineWidth(0.3);
    const textW = doc.getTextWidth(item.label);
    const pageNumW = doc.getTextWidth(String(item.page));
    const leaderStart = ctx.marginLeft + textW + 4;
    const leaderEnd = ctx.pageWidth - ctx.marginRight - pageNumW - 4;
    if (leaderEnd > leaderStart) {
      doc.setLineDashPattern([1, 3], 0);
      doc.line(leaderStart, ctx.y - 1, leaderEnd, ctx.y - 1);
      doc.setLineDashPattern([], 0);
    }

    ctx.y += 22;
  }
}

// ─── Section renderer dispatcher ─────────────────────────────────────────────

function renderSection(ctx, section, protocol) {
  ctx.addPageHeader();
  ctx.registerTOC(section.title, ctx.pageNum, ctx.y);

  // Section header bar
  renderSectionHeader(ctx, section);

  if (section.error) {
    renderErrorBlock(ctx, section.errorNote);
    return;
  }

  switch (section.sectionNumber) {
    case 1: renderSection1(ctx, section); break;
    case 2: renderSection2(ctx, section); break;
    case 3: renderSection3(ctx, section, protocol); break;
    case 4: renderSection4(ctx, section); break;
    case 5: renderSection5(ctx, section); break;
    case 6: renderSection6(ctx, section); break;
    case 7: renderSection7(ctx, section, protocol); break;
  }
}

function renderSectionHeader(ctx, section) {
  const { doc, colors } = ctx;
  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, 28, colors.purple);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colors.white);
  doc.text(`${section.sectionNumber}. ${section.title}`, ctx.marginLeft + 10, ctx.y + 17);
  ctx.y += 38;
}

function renderErrorBlock(ctx, message) {
  const { doc, colors } = ctx;
  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, 40, colors.redBg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.red);
  doc.text("⚠ Engine Error", ctx.marginLeft + 8, ctx.y + 14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.charcoal);
  const lines = doc.splitTextToSize(message || "Section failed to render.", ctx.contentWidth - 16);
  doc.text(lines, ctx.marginLeft + 8, ctx.y + 28);
  ctx.y += 50;
}

// ─── Section 1 ────────────────────────────────────────────────────────────────

function renderSection1(ctx, section) {
  for (const sub of section.subsections) {
    renderSubsectionHeader(ctx, sub.title);
    renderKeyValueBlock(ctx, sub.content);
    ctx.y += 8;
  }
}

// ─── Section 2 ────────────────────────────────────────────────────────────────

function renderSection2(ctx, section) {
  for (const sub of section.subsections) {
    renderSubsectionHeader(ctx, sub.title);
    renderKeyValueBlock(ctx, sub.content);
    ctx.y += 8;
  }
}

// ─── Section 3 — Bias ────────────────────────────────────────────────────────

function renderSection3(ctx, section, protocol) {
  const { doc, colors } = ctx;

  // Mode badge
  const modeColor = section.mode === "full" ? colors.teal : colors.amber;
  ctx.rect(ctx.marginLeft, ctx.y, section.mode === "full" ? 120 : 160, 16, modeColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.white);
  doc.text(section.mode === "full" ? "FULL MAPPING MODE" : "QUALITATIVE MODE", ctx.marginLeft + 6, ctx.y + 10);
  ctx.y += 24;

  // Vendor non-disclosure alert
  if (section.vendorNonDisclosure) {
    renderAlertBlock(ctx, "Vendor Non-Disclosure", "Vendor has not disclosed training data demographic composition. This is a governance finding. Treat all unverified axes as potential mismatches.", "red");
    ctx.y += 8;
  }

  // Principle statement
  renderPrincipleStatement(ctx, section.principleStatement);

  for (const sub of section.subsections) {
    ctx.needsPage(30);
    renderSubsectionHeader(ctx, sub.title);

    if (sub.content?.compatibilityTable) {
      renderCompatibilityTable(ctx, sub.content.compatibilityTable);
    } else if (sub.content?.flags && Array.isArray(sub.content.flags)) {
      renderFlagList(ctx, sub.content.flags);
    } else if (sub.content?.risks && Array.isArray(sub.content.risks)) {
      renderRiskList(ctx, sub.content.risks);
    } else if (sub.content?.narrativeSummary) {
      renderBodyText(ctx, sub.content.narrativeSummary);
      if (sub.content.mismatchFlags?.length > 0) {
        ctx.y += 8;
        renderFlagList(ctx, sub.content.mismatchFlags);
      }
    } else {
      renderKeyValueBlock(ctx, sub.content);
    }
    ctx.y += 8;
  }

  renderGapFlagBlock(ctx, section.biasGapFlags);
}

// ─── Section 4 — Monitoring Tiers ────────────────────────────────────────────

function renderSection4(ctx, section) {
  for (const sub of section.subsections) {
    ctx.needsPage(30);
    renderSubsectionHeader(ctx, sub.title);

    if (sub.title.includes("Westgard")) {
      renderWestgardRulesTable(ctx, sub.content);
    } else if (sub.title.includes("Stratified")) {
      renderStratifiedLimits(ctx, sub.content);
    } else if (sub.title.includes("Ownership")) {
      renderOwnershipBlock(ctx, sub.content);
    } else {
      renderKeyValueBlock(ctx, sub.content);
    }
    ctx.y += 8;
  }

  renderGapFlagBlock(ctx, section.tierGapFlags);
}

// ─── Section 5 — Node Assessment ─────────────────────────────────────────────

function renderSection5(ctx, section) {
  const { doc, colors } = ctx;

  // Overall rating
  const overallRating = section.overallRating;
  if (overallRating) {
    renderRatingBlock(ctx, overallRating.label, overallRating.summary, overallRating.rating);
    ctx.y += 10;
  }

  if (section.taxonomyNote) {
    renderBodyText(ctx, section.taxonomyNote, colors.midGray);
    ctx.y += 10;
  }

  for (const sub of section.subsections) {
    ctx.needsPage(30);
    renderSubsectionHeader(ctx, sub.title);

    if (sub.content?.nodeAssessments) {
      renderNodeAssessments(ctx, sub.content.nodeAssessments);
    } else if (sub.content?.warnings) {
      renderBulletList(ctx, sub.content.warnings, "◈");
    } else if (sub.content?.priorityActions) {
      renderPriorityActions(ctx, sub.content.priorityActions);
    }
    ctx.y += 8;
  }

  renderGapFlagBlock(ctx, section.nodeGapFlags);
}

// ─── Section 6 ────────────────────────────────────────────────────────────────

function renderSection6(ctx, section) {
  const readiness = section.deploymentReadiness;
  if (readiness) {
    renderRatingBlock(ctx, readiness.label, readiness.rationale, readiness.status === "recommended" ? "adequate" : readiness.status === "conditional" ? "moderate" : "critical");
    ctx.y += 10;
  }

  for (const sub of section.subsections) {
    ctx.needsPage(30);
    renderSubsectionHeader(ctx, sub.title);

    if (sub.content?.items && Array.isArray(sub.content.items)) {
      if (sub.title.includes("Checklist")) {
        renderChecklist(ctx, sub.content.items);
      } else {
        renderBulletList(ctx, sub.content.items, "•");
      }
    } else if (sub.content?.conditions) {
      renderConditionsList(ctx, sub.content.conditions);
    } else if (sub.content?.triggers) {
      renderBulletList(ctx, sub.content.triggers, "→");
    } else {
      renderKeyValueBlock(ctx, sub.content);
    }
    ctx.y += 8;
  }
}

// ─── Section 7 ────────────────────────────────────────────────────────────────

function renderSection7(ctx, section, protocol) {
  for (const sub of section.subsections) {
    ctx.needsPage(30);
    renderSubsectionHeader(ctx, sub.title);

    if (sub.content?.flags) {
      renderFlagList(ctx, sub.content.flags);
      if (sub.content.totalGaps !== undefined) {
        renderBodyText(ctx, `Total gap flags: ${sub.content.totalGaps}`);
      }
    } else if (sub.content?.items && sub.title.includes("Open Items")) {
      renderOpenItemsTable(ctx, sub.content.items, sub.content.note);
    } else {
      renderKeyValueBlock(ctx, sub.content);
    }
    ctx.y += 8;
  }

  // Final shelf life statement — hardcoded, always last
  ctx.needsPage(50);
  ctx.hRule(ctx.y, "teal");
  ctx.y += 14;
  const { doc, colors } = ctx;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.teal);
  const shelfLines = doc.splitTextToSize(protocol.meta.shelfLifeStatement, ctx.contentWidth);
  doc.text(shelfLines, ctx.marginLeft, ctx.y);
  ctx.y += shelfLines.length * 12 + 8;
}

// ─── Gap flags appendix ───────────────────────────────────────────────────────

function renderGapFlagsAppendix(ctx, protocol) {
  ctx.addPageHeader();
  const { doc, colors } = ctx;

  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, 28, colors.charcoal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...colors.white);
  doc.text("Appendix — Consolidated Gap Flags", ctx.marginLeft + 10, ctx.y + 17);
  ctx.y += 38;

  renderBodyText(ctx, `This appendix consolidates all ${protocol.allGapFlags.length} gap flags generated across this protocol. Each flag represents a missing governance input, an unresolved ambiguity, or a known limitation. Flags should be assigned to owners and tracked to resolution.`);
  ctx.y += 12;

  for (let i = 0; i < protocol.allGapFlags.length; i++) {
    const flag = protocol.allGapFlags[i];
    ctx.needsPage(30);
    const rowBg = i % 2 === 0 ? colors.paleGray : colors.white;
    const textLines = doc.splitTextToSize(flag, ctx.contentWidth - 36);
    const rowHeight = Math.max(20, textLines.length * 11 + 10);
    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, rowHeight, rowBg);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.amber);
    doc.text(`${i + 1}.`, ctx.marginLeft + 6, ctx.y + 13);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.charcoal);
    doc.text(textLines, ctx.marginLeft + 22, ctx.y + 13);
    ctx.y += rowHeight;
  }
}

// ─── Reusable render primitives ───────────────────────────────────────────────

function renderSubsectionHeader(ctx, title) {
  const { doc, colors } = ctx;
  ctx.needsPage(24);
  ctx.hRule(ctx.y, "lightGray");
  ctx.y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colors.purple);
  doc.text(title, ctx.marginLeft, ctx.y + 10);
  ctx.y += 20;
}

function renderKeyValueBlock(ctx, content) {
  if (!content) return;
  const { doc, colors } = ctx;
  const skipKeys = ["metricsNote", "note", "noDocumentsNote", "noGapsNote"];

  for (const [key, value] of Object.entries(content)) {
    if (skipKeys.includes(key) || value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    ctx.needsPage(18);
    const labelStr = camelToLabel(key);
    const valueStr = Array.isArray(value) ? value.join(", ") : String(value);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...colors.midGray);
    doc.text(labelStr.toUpperCase(), ctx.marginLeft, ctx.y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...colors.charcoal);
    const lines = doc.splitTextToSize(valueStr, ctx.contentWidth - 140);
    doc.text(lines, ctx.marginLeft + 140, ctx.y);
    ctx.y += Math.max(14, lines.length * 11);
  }

  // Notes inline
  for (const key of skipKeys) {
    if (content[key]) {
      ctx.needsPage(20);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.midGray);
      const lines = doc.splitTextToSize(content[key], ctx.contentWidth - 10);
      doc.text(lines, ctx.marginLeft + 5, ctx.y);
      ctx.y += lines.length * 10 + 4;
    }
  }
}

function renderBodyText(ctx, text, color) {
  if (!text) return;
  const { doc, colors } = ctx;
  ctx.needsPage(20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...(color || colors.charcoal));
  const lines = doc.splitTextToSize(text, ctx.contentWidth);
  doc.text(lines, ctx.marginLeft, ctx.y);
  ctx.y += lines.length * 12;
}

function renderPrincipleStatement(ctx, text) {
  if (!text) return;
  const { doc, colors } = ctx;
  ctx.needsPage(30);
  ctx.rect(ctx.marginLeft, ctx.y, 3, 24, colors.teal);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.teal);
  const lines = doc.splitTextToSize(text, ctx.contentWidth - 12);
  doc.text(lines, ctx.marginLeft + 10, ctx.y + 10);
  ctx.y += Math.max(28, lines.length * 11 + 8);
}

function renderAlertBlock(ctx, title, message, type) {
  const { doc, colors } = ctx;
  const bgColorMap = { red: colors.redBg, amber: colors.amberBg, green: colors.greenBg };
  const textColorMap = { red: colors.red, amber: colors.amber, green: colors.green };
  const bg = bgColorMap[type] || colors.grayBg;
  const tc = textColorMap[type] || colors.midGray;

  const msgLines = doc.splitTextToSize(message, ctx.contentWidth - 20);
  const height = 22 + msgLines.length * 10;
  ctx.needsPage(height + 4);
  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, height, bg);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...tc);
  doc.text(title, ctx.marginLeft + 8, ctx.y + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...colors.charcoal);
  doc.text(msgLines, ctx.marginLeft + 8, ctx.y + 24);
  ctx.y += height + 6;
}

function renderRatingBlock(ctx, label, summary, ratingKey) {
  const { doc, colors } = ctx;
  const ratingMap = {
    critical: { bg: colors.redBg, border: colors.red, text: colors.red },
    elevated: { bg: colors.amberBg, border: colors.amber, text: colors.amber },
    moderate: { bg: colors.amberBg, border: colors.amber, text: colors.amber },
    adequate: { bg: colors.greenBg, border: colors.green, text: colors.green },
    recommended: { bg: colors.greenBg, border: colors.green, text: colors.green },
    conditional: { bg: colors.amberBg, border: colors.amber, text: colors.amber },
    not_recommended: { bg: colors.redBg, border: colors.red, text: colors.red },
    unknown: { bg: colors.grayBg, border: colors.midGray, text: colors.midGray },
  };
  const rc = ratingMap[ratingKey] || ratingMap.unknown;
  const summaryLines = summary ? doc.splitTextToSize(summary, ctx.contentWidth - 20) : [];
  const height = 28 + summaryLines.length * 10 + 8;
  ctx.needsPage(height + 4);
  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, height, rc.bg);
  doc.setDrawColor(...rc.border);
  doc.setLineWidth(1);
  doc.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, height, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...rc.text);
  doc.text(label || "—", ctx.marginLeft + 10, ctx.y + 17);
  if (summaryLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.charcoal);
    doc.text(summaryLines, ctx.marginLeft + 10, ctx.y + 30);
  }
  ctx.y += height + 8;
}

function renderBulletList(ctx, items, bullet) {
  if (!items?.length) return;
  const { doc, colors } = ctx;
  for (const item of items) {
    const text = typeof item === "string" ? item : item.topAction || item.description || JSON.stringify(item);
    ctx.needsPage(18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.charcoal);
    doc.text(bullet || "•", ctx.marginLeft + 4, ctx.y);
    const lines = doc.splitTextToSize(text, ctx.contentWidth - 18);
    doc.text(lines, ctx.marginLeft + 16, ctx.y);
    ctx.y += lines.length * 11 + 4;
  }
}

function renderFlagList(ctx, flags) {
  if (!flags?.length) {
    renderBodyText(ctx, "No flags generated for this section.");
    return;
  }
  const { doc, colors } = ctx;
  for (const flag of flags) {
    ctx.needsPage(20);
    const lines = doc.splitTextToSize(flag, ctx.contentWidth - 18);
    const height = lines.length * 10 + 10;
    ctx.rect(ctx.marginLeft, ctx.y, 3, height, colors.amber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.charcoal);
    doc.text(lines, ctx.marginLeft + 10, ctx.y + 9);
    ctx.y += height + 4;
  }
}

function renderRiskList(ctx, risks) {
  if (!risks?.length) return;
  const { doc, colors } = ctx;
  for (const risk of risks) {
    const severityMap = { high: colors.red, moderate: colors.amber };
    const sc = severityMap[risk.severity] || colors.midGray;
    ctx.needsPage(50);

    const descLines = doc.splitTextToSize(risk.description || "", ctx.contentWidth - 16);
    const height = 14 + descLines.length * 10 + (risk.mitigationOptions ? risk.mitigationOptions.length * 10 + 8 : 0) + 16;
    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, height, colors.paleGray);
    ctx.rect(ctx.marginLeft, ctx.y, 3, height, sc);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...sc);
    doc.text(`${risk.risk} [${risk.severity?.toUpperCase() || "UNKNOWN"}]`, ctx.marginLeft + 10, ctx.y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.charcoal);
    doc.text(descLines, ctx.marginLeft + 10, ctx.y + 24);

    if (risk.mitigationOptions?.length > 0) {
      let miY = ctx.y + 24 + descLines.length * 10 + 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.midGray);
      doc.text("MITIGATION OPTIONS:", ctx.marginLeft + 10, miY);
      miY += 10;
      doc.setFont("helvetica", "normal");
      for (const opt of risk.mitigationOptions) {
        doc.text("→", ctx.marginLeft + 10, miY);
        const optLines = doc.splitTextToSize(opt, ctx.contentWidth - 28);
        doc.text(optLines, ctx.marginLeft + 20, miY);
        miY += optLines.length * 9 + 2;
      }
    }
    ctx.y += height + 8;
  }
}

function renderCompatibilityTable(ctx, table) {
  if (!table?.rows?.length) {
    renderBodyText(ctx, "Compatibility table could not be generated — insufficient demographic data provided.");
    return;
  }
  const { doc, colors } = ctx;

  // Summary stats first
  if (table.summary) {
    const s = table.summary;
    renderBodyText(ctx, `Assessment summary: ${s.compatible || 0} compatible, ${s.partial || 0} partial, ${s.incompatible || 0} incompatible, ${s.unknown || 0} unknown axes.`);
    if (s.highRiskIncompatibleCount > 0) {
      renderAlertBlock(ctx, `${s.highRiskIncompatibleCount} high-risk axes incompatible or unknown`, s.highRiskIncompatibleAxes?.join(", ") || "", "red");
    }
    ctx.y += 4;
  }

  const colWidths = [120, 50, 60, 60, 70, 60, 84]; // total ~504
  const headers = ["Demographic Axis", "Risk", "Vendor Rep.", "Local Rec.", "Compatibility", "Mismatch Risk", "Recommended Action"];

  // Header row
  const compatColorMap = {
    compatible: colors.greenBg,
    partial: colors.amberBg,
    incompatible: colors.redBg,
    unknown: colors.grayBg,
    not_tracked: colors.grayBg,
  };

  ctx.needsPage(22);
  let tableX = ctx.marginLeft;
  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, 16, colors.charcoal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...colors.white);
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], tableX + 3, ctx.y + 10);
    tableX += colWidths[i];
  }
  ctx.y += 16;

  // Data rows
  for (let ri = 0; ri < table.rows.length; ri++) {
    const row = table.rows[ri];
    const compatBg = compatColorMap[row.compatibility] || colors.paleGray;

    // Estimate row height
    const actionLines = doc.splitTextToSize(row.recommendedAction || "", colWidths[6] - 4);
    const rowH = Math.max(14, actionLines.length * 8 + 6);
    ctx.needsPage(rowH + 2);

    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, rowH, ri % 2 === 0 ? colors.white : colors.paleGray);

    // Compatibility cell highlight
    let xPos = ctx.marginLeft;
    for (let ci = 0; ci < 4; ci++) xPos += colWidths[ci];
    ctx.rect(xPos, ctx.y, colWidths[4], rowH, compatBg);

    // Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.charcoal);
    xPos = ctx.marginLeft;
    const cells = [
      row.axis,
      row.riskWeight,
      row.vendorReported,
      row.localRecorded,
      row.compatibilityDisplay?.label || row.compatibility,
      row.mismatchRisk,
      null, // action handled separately
    ];
    for (let ci = 0; ci < cells.length; ci++) {
      if (cells[ci]) {
        doc.text(String(cells[ci]), xPos + 3, ctx.y + rowH / 2 + 2);
      }
      xPos += colWidths[ci];
    }
    // Action cell (last)
    doc.setFontSize(7);
    doc.text(actionLines, ctx.marginLeft + colWidths.slice(0, 6).reduce((a, b) => a + b, 0) + 3, ctx.y + 9);
    ctx.y += rowH;
  }
  ctx.y += 8;
}

function renderWestgardRulesTable(ctx, content) {
  const rules = content?.rules;
  if (!rules?.length) return;
  const { doc, colors } = ctx;

  if (content.phaseInNote) {
    renderAlertBlock(ctx, "Phase-in Note", content.phaseInNote, "amber");
  }

  const tierColors = {
    warning: colors.amberBg,
    action: colors.redBg,
    stop: [255, 220, 220],
  };

  for (const rule of rules) {
    const threshLines = doc.splitTextToSize(rule.threshold || "", 140);
    const respLines = doc.splitTextToSize(rule.response || "", 170);
    const rowH = Math.max(40, Math.max(threshLines.length, respLines.length) * 10 + 14);
    ctx.needsPage(rowH + 4);

    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, rowH, rule.active === false ? colors.grayBg : (tierColors[rule.tier] || colors.paleGray));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.charcoal);
    doc.text(rule.westgardAnalog, ctx.marginLeft + 6, ctx.y + 13);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.midGray);
    const translLines = doc.splitTextToSize(rule.mlTranslation || "", ctx.contentWidth - 10);
    doc.text(translLines, ctx.marginLeft + 6, ctx.y + 23);

    const startX = ctx.marginLeft + 6;
    const threshX = startX + 160;
    const respX = threshX + 145;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.charcoal);
    doc.text(threshLines, threshX, ctx.y + 13);
    doc.text(respLines, respX, ctx.y + 13);

    if (rule.note) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...colors.midGray);
      doc.text(doc.splitTextToSize(rule.note, ctx.contentWidth - 10), ctx.marginLeft + 6, ctx.y + rowH - 6);
    }

    if (rule.active === false) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...colors.midGray);
      doc.text("NOT YET ACTIVE", ctx.pageWidth - ctx.marginRight - 60, ctx.y + 10);
    }

    ctx.y += rowH + 2;
  }
}

function renderStratifiedLimits(ctx, content) {
  if (!content) return;
  const { doc, colors } = ctx;

  if (content.rationale?.length > 0) {
    for (const r of content.rationale) {
      renderBodyText(ctx, r, colors.midGray);
      ctx.y += 2;
    }
    ctx.y += 6;
  }

  if (content.gaps?.length > 0) {
    renderFlagList(ctx, content.gaps);
    return;
  }

  for (const group of (content.stratifiedGroups || [])) {
    ctx.needsPage(36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.teal);
    doc.text(group.axis, ctx.marginLeft, ctx.y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.charcoal);
    ctx.y += 12;
    const recLines = doc.splitTextToSize(group.monitoringRecommendation, ctx.contentWidth - 10);
    doc.text(recLines, ctx.marginLeft + 10, ctx.y);
    ctx.y += recLines.length * 10 + 6;
  }
}

function renderOwnershipBlock(ctx, content) {
  if (!content?.ownershipStatement) return;
  const own = content.ownershipStatement;
  renderPrincipleStatement(ctx, own.principleStatement);
  renderBodyText(ctx, own.statement);
  ctx.y += 4;
  if (own.escalationPath) {
    renderAlertBlock(ctx, "Escalation Requirement", own.escalationPath, "amber");
  }
}

function renderNodeAssessments(ctx, nodeAssessments) {
  const { doc, colors } = ctx;
  const ratingColorMap = {
    critical: { bg: colors.redBg, border: colors.red, text: colors.red, badge: "CRITICAL" },
    moderate: { bg: colors.amberBg, border: colors.amber, text: colors.amber, badge: "MODERATE" },
    adequate: { bg: colors.greenBg, border: colors.green, text: colors.green, badge: "ADEQUATE" },
    unknown: { bg: colors.grayBg, border: colors.midGray, text: colors.midGray, badge: "UNKNOWN" },
  };

  for (const node of nodeAssessments) {
    const rc = ratingColorMap[node.rating] || ratingColorMap.unknown;
    const recs = node.recommendations || [];
    const recLines = recs.map(r => doc.splitTextToSize(r, ctx.contentWidth - 24));
    const totalRecLines = recLines.reduce((sum, rl) => sum + rl.length, 0);
    const height = 32 + totalRecLines * 10 + recs.length * 4 + (node.unknownIsSignal ? 12 : 0);

    ctx.needsPage(height + 6);
    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, height, rc.bg);
    doc.setDrawColor(...rc.border);
    doc.setLineWidth(0.5);
    doc.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, height, "S");

    // Node label + badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...colors.charcoal);
    doc.text(node.nodeLabel, ctx.marginLeft + 8, ctx.y + 14);
    doc.text(`— ${node.domain}`, ctx.marginLeft + 8 + doc.getTextWidth(node.nodeLabel) + 4, ctx.y + 14);

    // Rating badge
    ctx.rect(ctx.pageWidth - ctx.marginRight - 72, ctx.y + 4, 68, 14, rc.border);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.white);
    doc.text(rc.badge, ctx.pageWidth - ctx.marginRight - 68, ctx.y + 13);

    // Unknown signal note
    if (node.unknownIsSignal) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...colors.midGray);
      doc.text(`${node.unknownCount} unanswered signal questions — rating may understate risk.`, ctx.marginLeft + 8, ctx.y + 24);
    }

    // Recommendations
    let recY = ctx.y + (node.unknownIsSignal ? 34 : 24);
    for (let i = 0; i < recs.length; i++) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...rc.text);
      doc.text("→", ctx.marginLeft + 10, recY);
      doc.setTextColor(...colors.charcoal);
      doc.text(recLines[i], ctx.marginLeft + 20, recY);
      recY += recLines[i].length * 10 + 4;
    }

    ctx.y += height + 6;
  }
}

function renderPriorityActions(ctx, actions) {
  const { doc, colors } = ctx;
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    ctx.needsPage(30);
    const ratingColor = action.rating === "critical" ? colors.red : colors.amber;
    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, 26, i % 2 === 0 ? colors.paleGray : colors.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ratingColor);
    doc.text(`${i + 1}. ${action.node}`, ctx.marginLeft + 6, ctx.y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...colors.charcoal);
    const actLines = doc.splitTextToSize(action.topAction || "", ctx.contentWidth - 100);
    doc.text(actLines, ctx.marginLeft + 6, ctx.y + 21);
    ctx.y += Math.max(26, actLines.length * 10 + 16);
  }
}

function renderChecklist(ctx, items) {
  const { doc, colors } = ctx;
  const statusMap = {
    complete: { symbol: "✓", color: colors.green },
    incomplete: { symbol: "✗", color: colors.red },
    recommended: { symbol: "◈", color: colors.amber },
    "n/a-review-required": { symbol: "?", color: colors.midGray },
  };

  for (const item of items) {
    ctx.needsPage(16);
    const sc = statusMap[item.status] || { symbol: "—", color: colors.midGray };
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...sc.color);
    doc.text(sc.symbol, ctx.marginLeft + 4, ctx.y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.charcoal);
    doc.text(item.item || String(item), ctx.marginLeft + 18, ctx.y);
    ctx.y += 14;
  }
}

function renderConditionsList(ctx, conditions) {
  if (!conditions?.length) return;
  const { doc, colors } = ctx;
  for (const cond of conditions) {
    ctx.needsPage(20);
    const isRequired = cond.startsWith("REQUIRED");
    ctx.rect(ctx.marginLeft, ctx.y, 3, 16, isRequired ? colors.red : colors.amber);
    doc.setFont("helvetica", isRequired ? "bold" : "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...colors.charcoal);
    const lines = doc.splitTextToSize(cond, ctx.contentWidth - 14);
    doc.text(lines, ctx.marginLeft + 10, ctx.y + 11);
    ctx.y += lines.length * 11 + 6;
  }
}

function renderOpenItemsTable(ctx, items, note) {
  if (!items?.length) return;
  const { doc, colors } = ctx;
  const colWidths = [24, 260, 100, 80, 60]; // #, description, owner, target date, status

  if (note) {
    renderBodyText(ctx, note, colors.midGray);
    ctx.y += 6;
  }

  // Header
  ctx.needsPage(20);
  ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, 16, colors.charcoal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.white);
  const headers = ["#", "Description", "Owner", "Target Date", "Status"];
  let hX = ctx.marginLeft;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], hX + 3, ctx.y + 10);
    hX += colWidths[i];
  }
  ctx.y += 16;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const descLines = doc.splitTextToSize(item.description || "", colWidths[1] - 6);
    const rowH = Math.max(14, descLines.length * 9 + 6);
    ctx.needsPage(rowH + 2);
    ctx.rect(ctx.marginLeft, ctx.y, ctx.contentWidth, rowH, i % 2 === 0 ? colors.paleGray : colors.white);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.charcoal);
    let cX = ctx.marginLeft;
    doc.text(String(item.number || i + 1), cX + 3, ctx.y + rowH / 2 + 2);
    cX += colWidths[0];
    doc.text(descLines, cX + 3, ctx.y + 9);
    cX += colWidths[1];
    doc.text(item.owner || "—", cX + 3, ctx.y + rowH / 2 + 2);
    cX += colWidths[2];
    doc.text(item.targetDate || "—", cX + 3, ctx.y + rowH / 2 + 2);
    cX += colWidths[3];
    doc.setTextColor(item.status === "Open" ? ...colors.amber : ...colors.green);
    doc.text(item.status || "Open", cX + 3, ctx.y + rowH / 2 + 2);
    ctx.y += rowH;
  }
}

function renderGapFlagBlock(ctx, flags) {
  if (!flags?.length) return;
  ctx.y += 6;
  renderSubsectionHeader(ctx, "Section Gap Flags");
  renderFlagList(ctx, flags);
}

// ─── Page numbers ─────────────────────────────────────────────────────────────

function applyPageNumbers(ctx) {
  const { doc, colors } = ctx;
  const totalPages = ctx.pageNum;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.midGray);
    doc.text(
      `Page ${i} of ${totalPages}`,
      ctx.pageWidth / 2,
      ctx.pageHeight - 20,
      { align: "center" }
    );
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function camelToLabel(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function slugify(str) {
  return (str || "protocol")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function formatDateShort(date) {
  return date.toISOString().slice(0, 10);
}
