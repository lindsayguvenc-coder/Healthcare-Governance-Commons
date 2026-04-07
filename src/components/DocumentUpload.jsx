/**
 * DocumentUpload Component
 * Healthcare Governance Commons — Validation Protocol Generator
 *
 * Handles:
 * - Attestation checkbox (required before upload unlocks)
 * - PDF-only file type enforcement
 * - PHI scanning via /api/phi-check
 * - Metadata stripping via /api/strip-metadata
 * - Upload state management
 * - Gap flagging for missing documents
 *
 * Props:
 *   onDocumentsReady(documents) — called when ingestion is complete
 *   onGapFlags(flags) — called with array of gap flags from missing docs
 */

import { useState, useRef } from "react";

// Inject spinner keyframes
if (typeof document !== 'undefined') {
  const existing = document.head.querySelector('[data-commons-spinner]');
  if (!existing) {
    const style = document.createElement('style');
    style.setAttribute('data-commons-spinner', 'true');
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
}

const DOCUMENT_SLOTS = [
  {
    id: "model_card",
    label: "Model Card",
    required: true,
    description: "Vendor-provided document describing the AI model — intended use, training population, known limitations, default threshold.",
    hint: "Usually provided by the AI vendor at procurement or available on their documentation portal.",
  },
  {
    id: "validation_study",
    label: "Validation Study / Performance Evaluation",
    required: true,
    description: "Performance evaluation report — sensitivity, specificity, AUC/AUROC, validation population details.",
    hint: "May be titled 'Clinical Validation Report', 'Performance Evaluation', or 'Algorithm Validation Study'.",
  },
  {
    id: "ifu",
    label: "Instructions for Use (IFU)",
    required: false,
    description: "Vendor instructions specifying intended patient population, contraindications, operator requirements, and workflow integration.",
    hint: "Recommended. Strengthens threshold calibration and contraindication mapping.",
  },
  {
    id: "fda_clearance",
    label: "FDA 510(k) Summary or De Novo Decision",
    required: false,
    description: "FDA clearance documentation — cleared intended use, indications, contraindications, special conditions.",
    hint: "Recommended for cleared devices. Find at accessdata.fda.gov. Not applicable for all AI systems.",
  },
];

const UPLOAD_STATES = {
  IDLE: "idle",
  SCANNING: "scanning",
  STRIPPING: "stripping",
  READY: "ready",
  BLOCKED: "blocked",
  WARNING: "warning",
  ERROR: "error",
};

export default function DocumentUpload({ onDocumentsReady, onGapFlags }) {
  const [attested, setAttested] = useState(false);
  const [documents, setDocuments] = useState({});
  const [uploadStates, setUploadStates] = useState({});
  const [phiWarnings, setPhiWarnings] = useState({});
  const [warningAcknowledged, setWarningAcknowledged] = useState({});
  const fileInputRefs = useRef({});

  const updateDocState = (docId, state) => {
    setUploadStates((prev) => ({ ...prev, [docId]: state }));
  };

  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (docId, file) => {
    if (!file) return;

    // Enforce PDF only
    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      updateDocState(docId, UPLOAD_STATES.BLOCKED);
      setPhiWarnings((prev) => ({
        ...prev,
        [docId]: {
          status: "BLOCK",
          message: "Only PDF files are accepted. Please convert your document to PDF before uploading.",
        },
      }));
      return;
    }

    updateDocState(docId, UPLOAD_STATES.SCANNING);

    try {
      // Step 1: Extract text for PHI scanning
      let textContent = "";
      try {
        textContent = await readFileAsText(file);
      } catch {
        // Binary PDF — can't extract text directly, scan filename only
        textContent = file.name;
      }

      // Step 2: PHI scan
      const phiResponse = await fetch("/api/phi-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textContent.substring(0, 100000), // limit to 100KB of text
          source: `document_upload_${docId}`,
        }),
      });

      const phiResult = await phiResponse.json();

      // Hard block
      if (phiResult.summary?.status === "BLOCK") {
        updateDocState(docId, UPLOAD_STATES.BLOCKED);
        setPhiWarnings((prev) => ({
          ...prev,
          [docId]: phiResult.summary,
        }));
        return;
      }

      // Soft warning — surface to user, require acknowledgment before continuing
      if (phiResult.summary?.status === "WARN") {
        updateDocState(docId, UPLOAD_STATES.WARNING);
        setPhiWarnings((prev) => ({
          ...prev,
          [docId]: phiResult.summary,
        }));
        // Store file temporarily, wait for acknowledgment
        setDocuments((prev) => ({
          ...prev,
          [`${docId}_pending`]: file,
        }));
        return;
      }

      // Clear — proceed to metadata stripping
      await processCleanFile(docId, file);
    } catch (err) {
      console.error("Upload processing error:", err);
      updateDocState(docId, UPLOAD_STATES.ERROR);
    }
  };

  const processCleanFile = async (docId, file) => {
    updateDocState(docId, UPLOAD_STATES.STRIPPING);

    try {
      const base64 = await readFileAsBase64(file);

      // Strip metadata
      const stripResponse = await fetch("/api/strip-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64pdf: base64,
          filename: file.name,
        }),
      });

      const stripResult = await stripResponse.json();

      if (!stripResponse.ok) {
        throw new Error(stripResult.error || "Metadata stripping failed");
      }

      // Store cleaned document
      setDocuments((prev) => ({
        ...prev,
        [docId]: {
          id: docId,
          filename: file.name,
          base64: stripResult.base64pdf,
          size: file.size,
          processedAt: stripResult.strippedAt,
        },
      }));

      updateDocState(docId, UPLOAD_STATES.READY);
    } catch (err) {
      console.error("Metadata stripping error:", err);
      // Fall back to storing original if stripping fails
      try {
        const base64 = await readFileAsBase64(file);
        setDocuments((prev) => ({
          ...prev,
          [docId]: {
            id: docId,
            filename: file.name,
            base64,
            size: file.size,
            metadataStripped: false,
          },
        }));
        updateDocState(docId, UPLOAD_STATES.READY);
      } catch {
        updateDocState(docId, UPLOAD_STATES.ERROR);
      }
    }
  };

  const handleWarningAcknowledge = async (docId) => {
    setWarningAcknowledged((prev) => ({ ...prev, [docId]: true }));
    const pendingFile = documents[`${docId}_pending`];
    if (pendingFile) {
      setDocuments((prev) => {
        const next = { ...prev };
        delete next[`${docId}_pending`];
        return next;
      });
      await processCleanFile(docId, pendingFile);
    }
  };

  const handleRemoveDocument = (docId) => {
    setDocuments((prev) => {
      const next = { ...prev };
      delete next[docId];
      delete next[`${docId}_pending`];
      return next;
    });
    setUploadStates((prev) => ({ ...prev, [docId]: UPLOAD_STATES.IDLE }));
    setPhiWarnings((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    setWarningAcknowledged((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    if (fileInputRefs.current[docId]) {
      fileInputRefs.current[docId].value = "";
    }
  };

  const requiredDocsMet = DOCUMENT_SLOTS.filter((s) => s.required).every(
    (s) => uploadStates[s.id] === UPLOAD_STATES.READY
  );

  const canProceed =
    attested &&
    requiredDocsMet &&
    !Object.values(uploadStates).includes(UPLOAD_STATES.BLOCKED) &&
    !Object.values(uploadStates).includes(UPLOAD_STATES.SCANNING) &&
    !Object.values(uploadStates).includes(UPLOAD_STATES.STRIPPING) &&
    !Object.values(uploadStates).includes(UPLOAD_STATES.WARNING);

  const handleProceed = () => {
    // Build gap flags for missing recommended docs
    const gapFlags = DOCUMENT_SLOTS.filter(
      (s) => !s.required && uploadStates[s.id] !== UPLOAD_STATES.READY
    ).map((s) => ({
      type: "DOCUMENT_ABSENT",
      docId: s.id,
      docLabel: s.label,
      severity: "MEDIUM",
      message: `${s.label} was not submitted. Sections dependent on this document will note reduced confidence.`,
      destination: "section_7",
    }));

    onGapFlags && onGapFlags(gapFlags);
    onDocumentsReady && onDocumentsReady(documents);
  };

  return (
    <div style={styles.container}>

      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>Upload Your Documents</h2>
        <p style={styles.subtitle}>
          The Commons will extract relevant fields from your documents before the elicitation begins.
          Questions that your documents already answer will not appear.
          Works best on desktop — you'll need your documents handy.
        </p>
      </div>

      {/* Attestation — must be checked before uploads unlock */}
      <div style={styles.attestationBox}>
        <label style={styles.attestationLabel}>
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.attestationText}>
            I confirm that the documents I am uploading do not contain protected health information (PHI)
            as defined under HIPAA. Model cards, validation studies, Instructions for Use, and FDA clearance
            documents are vendor-generated documents and should not contain patient-level data. If I am
            uploading an internally-generated document, I have reviewed it for patient-identifiable information.
          </span>
        </label>
      </div>

      {/* Document slots */}
      <div style={styles.slotsContainer}>
        {DOCUMENT_SLOTS.map((slot) => {
          const state = uploadStates[slot.id] || UPLOAD_STATES.IDLE;
          const doc = documents[slot.id];
          const warning = phiWarnings[slot.id];
          const isLocked = !attested;

          return (
            <div
              key={slot.id}
              style={{
                ...styles.slot,
                ...(isLocked ? styles.slotLocked : {}),
                ...(state === UPLOAD_STATES.READY ? styles.slotReady : {}),
                ...(state === UPLOAD_STATES.BLOCKED ? styles.slotBlocked : {}),
                ...(state === UPLOAD_STATES.WARNING ? styles.slotWarning : {}),
              }}
            >
              {/* Slot header */}
              <div style={styles.slotHeader}>
                <div style={styles.slotLabelRow}>
                  <span style={styles.slotLabel}>{slot.label}</span>
                  <span style={{
                    ...styles.badge,
                    ...(slot.required ? styles.badgeRequired : styles.badgeRecommended),
                  }}>
                    {slot.required ? "Required" : "Recommended"}
                  </span>
                </div>
                <p style={styles.slotDescription}>{slot.description}</p>
                <p style={styles.slotHint}>{slot.hint}</p>
              </div>

              {/* Upload area */}
              {state === UPLOAD_STATES.IDLE && (
                <div style={styles.uploadArea}>
                  <input
                    ref={(el) => (fileInputRefs.current[slot.id] = el)}
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={isLocked}
                    onChange={(e) => handleFileSelect(slot.id, e.target.files[0])}
                    style={styles.fileInput}
                    id={`upload-${slot.id}`}
                  />
                  <label
                    htmlFor={`upload-${slot.id}`}
                    style={{
                      ...styles.uploadButton,
                      ...(isLocked ? styles.uploadButtonDisabled : {}),
                    }}
                  >
                    {isLocked ? "↑ Confirm attestation above to upload" : "↑ Select PDF"}
                  </label>
                  <span style={styles.uploadHint}>PDF only · Max 20MB</span>
                </div>
              )}

              {/* Scanning state */}
              {(state === UPLOAD_STATES.SCANNING || state === UPLOAD_STATES.STRIPPING) && (
                <div style={styles.processingState}>
                  <div style={styles.spinner} />
                  <span style={styles.processingText}>
                    {state === UPLOAD_STATES.SCANNING
                      ? "Scanning for PHI patterns..."
                      : "Stripping metadata..."}
                  </span>
                </div>
              )}

              {/* Ready state */}
              {state === UPLOAD_STATES.READY && doc && (
                <div style={styles.readyState}>
                  <span style={styles.checkmark}>✓</span>
                  <span style={styles.filename}>{doc.filename}</span>
                  <button
                    onClick={() => handleRemoveDocument(slot.id)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Blocked state */}
              {state === UPLOAD_STATES.BLOCKED && warning && (
                <div style={styles.blockedState}>
                  <p style={styles.blockedMessage}>⚠ {warning.message}</p>
                  <button
                    onClick={() => handleRemoveDocument(slot.id)}
                    style={styles.retryButton}
                  >
                    Try a different file
                  </button>
                </div>
              )}

              {/* Warning state — requires acknowledgment */}
              {state === UPLOAD_STATES.WARNING && warning && !warningAcknowledged[slot.id] && (
                <div style={styles.warningState}>
                  <p style={styles.warningMessage}>⚠ {warning.message}</p>
                  <div style={styles.warningActions}>
                    <button
                      onClick={() => handleWarningAcknowledge(slot.id)}
                      style={styles.acknowledgeButton}
                    >
                      I have reviewed this document — proceed
                    </button>
                    <button
                      onClick={() => handleRemoveDocument(slot.id)}
                      style={styles.retryButton}
                    >
                      Use a different file
                    </button>
                  </div>
                </div>
              )}

              {/* Error state */}
              {state === UPLOAD_STATES.ERROR && (
                <div style={styles.blockedState}>
                  <p style={styles.blockedMessage}>
                    Something went wrong processing this file. Please try again.
                  </p>
                  <button
                    onClick={() => handleRemoveDocument(slot.id)}
                    style={styles.retryButton}
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Missing required docs warning */}
      {attested && !requiredDocsMet && (
        <div style={styles.missingRequired}>
          <p>
            <strong>Both required documents must be uploaded to proceed.</strong>{" "}
            Without a model card and validation study, threshold calibration and
            performance sections cannot be populated.
          </p>
        </div>
      )}

      {/* Proceed button */}
      <div style={styles.proceedArea}>
        <button
          onClick={handleProceed}
          disabled={!canProceed}
          style={{
            ...styles.proceedButton,
            ...(!canProceed ? styles.proceedButtonDisabled : {}),
          }}
        >
          Begin elicitation →
        </button>
        {attested && requiredDocsMet && (
          <p style={styles.proceedNote}>
            {DOCUMENT_SLOTS.filter(
              (s) => !s.required && uploadStates[s.id] !== UPLOAD_STATES.READY
            ).length > 0 && (
              <>
                {
                  DOCUMENT_SLOTS.filter(
                    (s) =>
                      !s.required && uploadStates[s.id] !== UPLOAD_STATES.READY
                  ).length
                }{" "}
                recommended document
                {DOCUMENT_SLOTS.filter(
                  (s) =>
                    !s.required && uploadStates[s.id] !== UPLOAD_STATES.READY
                ).length > 1
                  ? "s"
                  : ""}{" "}
                not submitted — affected sections will note reduced confidence.
              </>
            )}
          </p>
        )}
      </div>

      {/* Privacy notice link */}
      <p style={styles.privacyLink}>
        <a href="/privacy" target="_blank" style={styles.link}>
          Privacy notice
        </a>{" "}
        — how submitted documents are handled.
      </p>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: "720px",
    margin: "0 auto",
    padding: "0 0 40px",
    fontFamily: "Helvetica, Arial, sans-serif",
  },
  header: {
    marginBottom: "32px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: "12px",
  },
  subtitle: {
    fontSize: "15px",
    color: "#6b7080",
    lineHeight: "1.6",
  },
  attestationBox: {
    background: "#f3f0ff",
    borderLeft: "4px solid #7c5cbf",
    padding: "20px 24px",
    marginBottom: "32px",
    borderRadius: "0 4px 4px 0",
  },
  attestationLabel: {
    display: "flex",
    gap: "12px",
    cursor: "pointer",
    alignItems: "flex-start",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    marginTop: "2px",
    flexShrink: 0,
    cursor: "pointer",
    accentColor: "#7c5cbf",
  },
  attestationText: {
    fontSize: "14px",
    color: "#1a1a2e",
    lineHeight: "1.6",
  },
  slotsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "24px",
  },
  slot: {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "20px 24px",
    background: "#ffffff",
    transition: "border-color 0.2s",
  },
  slotLocked: {
    opacity: "0.6",
  },
  slotReady: {
    borderColor: "#7c5cbf",
    background: "#faf9ff",
  },
  slotBlocked: {
    borderColor: "#cc0000",
    background: "#fff0f0",
  },
  slotWarning: {
    borderColor: "#f0a500",
    background: "#fff8e1",
  },
  slotHeader: {
    marginBottom: "16px",
  },
  slotLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  slotLabel: {
    fontSize: "15px",
    fontWeight: "700",
    color: "#1a1a2e",
  },
  badge: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "2px 8px",
    borderRadius: "10px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  badgeRequired: {
    background: "#1a1a2e",
    color: "#ffffff",
  },
  badgeRecommended: {
    background: "#e8e4f5",
    color: "#7c5cbf",
  },
  slotDescription: {
    fontSize: "14px",
    color: "#1a1a2e",
    lineHeight: "1.5",
    marginBottom: "6px",
  },
  slotHint: {
    fontSize: "13px",
    color: "#6b7080",
    fontStyle: "italic",
    lineHeight: "1.4",
  },
  uploadArea: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  fileInput: {
    display: "none",
  },
  uploadButton: {
    background: "#7c5cbf",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "10px 20px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    display: "inline-block",
  },
  uploadButtonDisabled: {
    background: "#c4b8e8",
    cursor: "not-allowed",
    fontSize: "13px",
  },
  uploadHint: {
    fontSize: "12px",
    color: "#6b7080",
  },
  processingState: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 0",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid #e0e0e0",
    borderTopColor: "#7c5cbf",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  processingText: {
    fontSize: "14px",
    color: "#6b7080",
  },
  readyState: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  checkmark: {
    color: "#7c5cbf",
    fontWeight: "700",
    fontSize: "16px",
  },
  filename: {
    fontSize: "14px",
    color: "#1a1a2e",
    flex: 1,
  },
  removeButton: {
    background: "none",
    border: "none",
    color: "#6b7080",
    fontSize: "13px",
    cursor: "pointer",
    textDecoration: "underline",
    padding: "0",
  },
  blockedState: {
    padding: "4px 0",
  },
  blockedMessage: {
    fontSize: "14px",
    color: "#cc0000",
    lineHeight: "1.5",
    marginBottom: "10px",
  },
  warningState: {
    padding: "4px 0",
  },
  warningMessage: {
    fontSize: "14px",
    color: "#7a5200",
    lineHeight: "1.5",
    marginBottom: "12px",
  },
  warningActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  acknowledgeButton: {
    background: "#f0a500",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  retryButton: {
    background: "none",
    border: "1px solid #6b7080",
    borderRadius: "6px",
    padding: "8px 16px",
    fontSize: "13px",
    color: "#6b7080",
    cursor: "pointer",
  },
  missingRequired: {
    background: "#fff0f0",
    borderLeft: "4px solid #cc0000",
    padding: "16px 20px",
    marginBottom: "24px",
    borderRadius: "0 4px 4px 0",
    fontSize: "14px",
    color: "#1a1a2e",
    lineHeight: "1.5",
  },
  proceedArea: {
    marginBottom: "16px",
  },
  proceedButton: {
    background: "#7c5cbf",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "14px 32px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    display: "block",
    width: "100%",
    textAlign: "center",
  },
  proceedButtonDisabled: {
    background: "#c4b8e8",
    cursor: "not-allowed",
  },
  proceedNote: {
    fontSize: "13px",
    color: "#6b7080",
    marginTop: "10px",
    fontStyle: "italic",
  },
  privacyLink: {
    fontSize: "13px",
    color: "#6b7080",
    textAlign: "center",
  },
  link: {
    color: "#7c5cbf",
    textDecoration: "none",
  },
};
