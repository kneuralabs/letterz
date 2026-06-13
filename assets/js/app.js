/*
 * Letterz — Kneuralabs Letter & Contract Studio
 * ------------------------------------------------------------------
 * Zero-build client app. The script is organised into cohesive modules
 * inside one IIFE to keep the global scope clean:
 *
 *   logo      — preloads LOGO.png as a data URL for letterhead/print
 *   dom       — cached lookups for stable elements + small helpers
 *   templates — config-driven registry of document types
 *   editor    — dynamic field rendering + rich-text formatting
 *   preview   — renders the live letter (single source of truth)
 *   actions   — copy / print
 *   mail      — config persistence + EmailJS/mailto sending
 *   ui        — modal + event wiring + bootstrap
 */
(function () {
  'use strict';

  /* ── dom: cached stable elements + helpers ───────────────────── */
  const byId = (id) => document.getElementById(id);
  const dom = {
    letterType:        byId('letterType'),
    issueDate:         byId('issueDateField'),
    managerName:       byId('managerNameField'),
    dynamicContainer:  byId('dynamicFieldsContainer'),
    preview:           byId('letterPreview'),
    liveBadge:         byId('liveBadge'),
    editorBadge:       byId('editorBadge'),
    toolbar:           byId('globalToolbar'),
    modal:             byId('settingsModal'),
  };
  const getRichHTML = (id) => { const el = byId(id); return el ? el.innerHTML : ''; };

  /** Short, human label for the currently selected document type. */
  function currentTypeLabel() {
    const opt = dom.letterType.options[dom.letterType.selectedIndex];
    return opt.text.split(' / ')[0].split(' (')[0];
  }

  /** Descriptive PDF filename, e.g. "Kneuralabs_Employment-Contract_Dr-Neha-Verma_19-Feb-2026". */
  function pdfName() {
    const slug = (s) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ')
      .trim().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
    const type  = slug(currentTypeLabel());
    const party = slug(getRichHTML('employeeFirstField') + '-' + getRichHTML('employeeLastField')) || 'Letter';
    const date  = formatDate(dom.issueDate.value).replace(/\//g, '-');
    return `Kneuralabs_${type}_${party}_${date}`.replace(/_+/g, '_');
  }

  /* ── logo: preload as data URL (used in letterhead + print) ──── */
  let logoDataUrl = 'LOGO.png';
  fetch('LOGO.png')
    .then(r => r.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onload = () => { logoDataUrl = reader.result; updatePreview(); };
      reader.readAsDataURL(blob);
    })
    .catch(() => {});

  /* ── editor: rich-text formatting toolbar ────────────────────── */
  let activeEditable = null;
  const trackFocus = (el) => { activeEditable = el; };

  document.querySelectorAll('.rich-input').forEach((el) => {
    el.addEventListener('focus', (e) => trackFocus(e.currentTarget));
    el.addEventListener('click', (e) => trackFocus(e.currentTarget));
  });

  dom.toolbar.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!activeEditable) {
        const first = document.querySelector('.rich-input');
        if (!first) return;
        activeEditable = first; first.focus();
      }
      document.execCommand(btn.getAttribute('data-cmd'), false, null);
      activeEditable.focus();
      updatePreview();
    });
  });

  // ── Letter templates ──
  const letterTemplates = {
    contract: {
      fields: [
        { name:"startDate",          label:"Contract start date",             type:"date", defaultVal:"2026-03-02" },
        { name:"contractTermMonths", label:"Contract term (months)",          type:"text", defaultVal:"12" },
        { name:"annualSalary",       label:"Total compensation during tenure",type:"text", defaultVal:"$155,000 per annum (pro-rated for the term), plus a discretionary performance bonus" }
      ],
      template: d => `<div><strong>EMPLOYMENT CONTRACT</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br>
<strong>Employee:</strong> ${d.employeeName}<br>
<strong>Role:</strong> ${d.employeeRole}<br>
<strong>Signatory:</strong> ${d.managerName}<br><br>
This Employment Contract ("Agreement") is made between Kneuralabs ("the Company") and ${d.employeeName} ("the Employee").<br><br>
<strong>1. Term.</strong> Employment begins on ${d.startDate} and continues for a fixed term of ${d.contractTermMonths} month(s), concluding on ${d.endDate} unless extended in writing by the Company. This fixed-term engagement creates no permanent or indefinite employment.<br>
<strong>2. Compensation.</strong> ${d.annualSalary}. All salary, bonus, equity and benefits are subject to applicable taxes and statutory deductions and to the Company's prevailing policies, which may change from time to time.<br>
<strong>3. Duties &amp; conduct.</strong> The Employee shall perform the duties of the Role diligently, in good faith, and in compliance with all lawful Company policies and applicable law.<br>
<strong>4. Confidentiality &amp; intellectual property.</strong> All models, code, architectures, research and other work product created in connection with the engagement are "works made for hire" and remain the sole property of Kneuralabs. Confidentiality and IP obligations survive termination.<br>
<strong>5. Termination.</strong> Either party may terminate this Agreement on thirty (30) days' written notice; the Company may terminate immediately for cause. On termination the Employee shall return all Company property, data and confidential information.<br>
<strong>6. Governing law.</strong> This Agreement is governed by the laws of the State of Connecticut, USA, constitutes the entire agreement between the parties and supersedes all prior understandings. If any provision is held invalid, the remainder shall continue in full force.<br>
${d.additionalNotes ? `<br><strong>Additional terms:</strong> ${d.additionalNotes}<br>` : ""}
<br>Sincerely,<br>${d.managerName}<br>Kneuralabs</div>`
    },
    appointment: {
      fields: [
        { name:"reportingManager", label:"Reporting manager",   type:"text", defaultVal:"Chief AI Officer" },
        { name:"offerPackage",     label:"Offer package",       type:"text", defaultVal:"$140,000 per annum, plus discretionary equity under the Kneuralabs ESOP" },
        { name:"startDay",         label:"Proposed start date", type:"date", defaultVal:"2026-03-16" }
      ],
      template: d => `<div><strong>OFFER LETTER</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br>
<strong>To:</strong> ${d.employeeName}<br>
<strong>Role:</strong> ${d.employeeRole}<br><br>
Dear ${d.employeeName},<br><br>
We are pleased to offer you the position of ${d.employeeRole} at Kneuralabs, reporting to the ${d.reportingManager}, with a proposed start date of ${d.startDay}.<br><br>
<strong>1. Compensation.</strong> ${d.offerPackage}. All bonus, equity and benefits are discretionary and subject to the Company's prevailing policies and applicable taxes.<br>
<strong>2. Conditions.</strong> This offer is contingent upon satisfactory background, reference and right-to-work verification, and upon your acceptance of the Company's confidentiality and intellectual-property terms. Employment is offered on a fixed-term, renewable basis and is not a guarantee of permanent employment.<br>
<strong>3. Validity.</strong> This offer is open for acceptance for seven (7) days from the date above. The Company reserves the right to amend or withdraw this offer at any time prior to your acceptance.<br>
<strong>4. Governing law.</strong> This letter is governed by the laws of the State of Connecticut, USA, and constitutes the entire offer, superseding any prior discussions.<br>
${d.additionalNotes ? `<br><em>${d.additionalNotes}</em><br>` : ""}
<br>We look forward to welcoming you to the team.<br><br>Best regards,<br>${d.managerName}<br>Kneuralabs</div>`
    },
    termination: {
      fields: [
        { name:"terminationReason", label:"Reason",           type:"text", defaultVal:"Strategic restructuring of the team" },
        { name:"lastDay",           label:"Last working day", type:"date", defaultVal:"2026-03-31" },
        { name:"severanceInfo",     label:"Final settlement", type:"text", defaultVal:"two (2) months' salary in lieu of notice, subject to applicable deductions" }
      ],
      template: d => `<div><strong>TERMINATION OF EMPLOYMENT</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br>
<strong>To:</strong> ${d.employeeName}<br><br>
This letter confirms that your employment with Kneuralabs will end effective ${d.lastDay}.<br><br>
<strong>1. Reason.</strong> ${d.terminationReason}. This decision does not reflect any allegation of misconduct unless separately notified to you in writing.<br>
<strong>2. Final settlement.</strong> ${d.severanceInfo}. Your final dues, less applicable deductions and the recovery of any Company property or advances, will be settled in accordance with applicable law.<br>
<strong>3. Continuing obligations.</strong> Your confidentiality, non-disclosure and intellectual-property obligations survive the end of employment. You agree to return all Company property and data on or before your last working day.<br>
<strong>4. Governing law.</strong> This letter is governed by the laws of the State of Connecticut, USA.<br>
${d.additionalNotes ? `<br>${d.additionalNotes}<br>` : ""}
<br>We thank you for your contributions and wish you well.<br><br>Regards,<br>${d.managerName}<br>Kneuralabs</div>`
    },
    promotion: {
      fields: [
        { name:"newTitle",       label:"New title",          type:"text", defaultVal:"Lead AI Architect (Level 6)" },
        { name:"newComp",        label:"New salary / equity",type:"text", defaultVal:"$185,000 per annum, plus discretionary equity under the Kneuralabs ESOP" },
        { name:"effectivePromo", label:"Effective date",     type:"date", defaultVal:"2026-03-02" }
      ],
      template: d => `<div><strong>PROMOTION LETTER</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br>
<strong>Employee:</strong> ${d.employeeName}<br>
<strong>Current role:</strong> ${d.employeeRole}<br><br>
We are pleased to confirm your promotion to ${d.newTitle}, effective ${d.effectivePromo}.<br><br>
<strong>1. Compensation.</strong> ${d.newComp}. All revised compensation, bonus and equity are discretionary and subject to the Company's prevailing policies and applicable taxes.<br>
<strong>2. Other terms.</strong> All other terms of your existing engagement remain unchanged and in full force. This promotion does not alter the fixed-term nature of your engagement and creates no guarantee of continued or permanent employment.<br>
<strong>3. Governing law.</strong> This letter is governed by the laws of the State of Connecticut, USA, and supersedes any prior discussions regarding your role or compensation.<br>
${d.additionalNotes ? `<br>${d.additionalNotes}<br>` : ""}
<br>Congratulations,<br>${d.managerName}<br>Kneuralabs</div>`
    },
    nda: {
      fields: [
        { name:"otherParty",       label:"Other party",          type:"text", defaultVal:"Neural Tech Partners LLC" },
        { name:"purpose",          label:"Purpose",              type:"text", defaultVal:"evaluation of a potential commercial collaboration" },
        { name:"confidentialTerm", label:"Confidentiality term", type:"text", defaultVal:"three (3) years from the date of disclosure" }
      ],
      template: d => `<div><strong>MUTUAL NON-DISCLOSURE AGREEMENT</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br><br>
This Mutual Non-Disclosure Agreement ("Agreement") is entered into between Kneuralabs and ${d.otherParty} (each a "Party").<br><br>
<strong>1. Purpose.</strong> ${d.purpose}.<br>
<strong>2. Confidential information.</strong> Each Party may disclose proprietary or confidential information. The receiving Party shall use such information solely for the Purpose, protect it with at least reasonable care, and not disclose it to any third party without the disclosing Party's prior written consent.<br>
<strong>3. Term.</strong> The confidentiality obligations remain in force for ${d.confidentialTerm}.<br>
<strong>4. No license or obligation.</strong> Nothing in this Agreement grants any license or intellectual-property right, or obligates either Party to enter into any further agreement. All disclosed information remains the property of the disclosing Party.<br>
<strong>5. Governing law.</strong> This Agreement is governed by the laws of the State of Connecticut, USA. If any provision is held invalid, the remainder shall continue in full force.<br>
Authorised representative for Kneuralabs: ${d.employeeName} (${d.employeeRole}).<br>
${d.additionalNotes ? `<br>${d.additionalNotes}<br>` : ""}
<br>Signed for Kneuralabs,<br>${d.managerName}</div>`
    },
    sow: {
      fields: [
        { name:"projectName",  label:"Project name",     type:"text", defaultVal:"Edge Neural Core" },
        { name:"deliverables", label:"Key deliverables", type:"text", defaultVal:"an optimised inference model and accompanying technical documentation" },
        { name:"deadline",     label:"Deadline",         type:"date", defaultVal:"2026-05-29" }
      ],
      template: d => `<div><strong>STATEMENT OF WORK</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br><br>
This Statement of Work ("SOW") is issued by Kneuralabs ("the Company") to ${d.employeeName} (${d.employeeRole}) ("the Consultant").<br><br>
<strong>1. Project.</strong> ${d.projectName}.<br>
<strong>2. Deliverables.</strong> ${d.deliverables}, to be completed by ${d.deadline}. Acceptance is subject to the Company's written approval.<br>
<strong>3. Fees.</strong> Fees are payable only against accepted deliverables and valid invoices, and are exclusive of applicable taxes.<br>
<strong>4. Intellectual property.</strong> All deliverables, work product and related intellectual property are works made for hire and vest exclusively in Kneuralabs upon creation; the Consultant assigns all rights therein to the Company.<br>
<strong>5. Independent contractor &amp; confidentiality.</strong> The Consultant acts as an independent contractor and shall maintain strict confidentiality; nothing herein creates employment, partnership or agency.<br>
<strong>6. Governing law.</strong> This SOW is governed by the laws of the State of Connecticut, USA, and supersedes any prior understanding for this project.<br>
${d.additionalNotes ? `<br>${d.additionalNotes}<br>` : ""}
<br>For Kneuralabs,<br>${d.managerName}</div>`
    },
    invoice: {
      fields: [
        { name:"invoiceNumber", label:"Invoice number",      type:"text", defaultVal:"KNL-INV-1001" },
        { name:"billTo",        label:"Bill to",             type:"text", defaultVal:"Neural Tech Partners LLC, 345 Buckland Hills Dr, Manchester, CT 06042, USA" },
        { name:"invoiceAmount", label:"Amount due",          type:"text", defaultVal:"$4,500.00 (exclusive of applicable taxes)" },
        { name:"dueDate",       label:"Due date",            type:"date", defaultVal:"2026-03-05" },
        { name:"invoiceItems",  label:"Items / description", type:"text", defaultVal:"AI consulting services rendered — February 2026" }
      ],
      template: d => `<div><strong>INVOICE</strong><br><br>
<strong>Invoice #:</strong> ${d.invoiceNumber}<br>
<strong>Date:</strong> ${d.issueDate}<br>
<strong>Due date:</strong> ${d.dueDate}<br>
<strong>Bill to:</strong> ${d.billTo}<br>
<strong>Prepared by:</strong> ${d.employeeName} (${d.employeeRole})<br><br>
<strong>Description:</strong> ${d.invoiceItems}<br>
<strong>Amount due:</strong> ${d.invoiceAmount}<br><br>
Payment is due by the due date stated above. Amounts are exclusive of applicable taxes unless otherwise stated. Overdue amounts may attract interest at the maximum rate permitted by law. All work and deliverables remain the property of Kneuralabs until payment is received in full.<br>
${d.additionalNotes ? `<br><strong>Notes:</strong> ${d.additionalNotes}<br>` : ""}
<br>Thank you for your business.<br><br>${d.managerName}<br>Kneuralabs</div>`
    },
    general: {
      fields: [
        { name:"letterSubject",    label:"Subject",            type:"text", defaultVal:"Letter of Confirmation" },
        { name:"recipientAddress", label:"Recipient / address",type:"text", defaultVal:"To whom it may concern" }
      ],
      template: d => `<div><strong>${(d.letterSubject || '').toUpperCase()}</strong><br><br>
<strong>Date:</strong> ${d.issueDate}<br><br>
${d.recipientAddress},<br><br>
${d.additionalNotes || 'This letter is issued by Kneuralabs in relation to the subject stated above.'}<br><br>
This letter is issued by Kneuralabs for the purpose stated above and creates no legal obligation or representation beyond its express terms. It is governed by the laws of the State of Connecticut, USA.<br><br>
Regards,<br>${d.managerName}<br>Kneuralabs</div>`
    }
  };

  /* ── editor: dynamic fields per document type ────────────────── */
  function rebuildDynamicFields(type) {
    const config = letterTemplates[type];
    if (!config) return;
    dom.dynamicContainer.innerHTML = '';
    config.fields.forEach((field) => {
      const group = document.createElement('div');
      group.className = 'fgrp';
      const label = document.createElement('label');
      label.innerText = field.label;
      group.appendChild(label);
      if (field.type === 'date') {
        const inp = document.createElement('input');
        inp.type = 'date'; inp.name = field.name; inp.className = 'dynamic-date'; inp.value = field.defaultVal; inp.min = '2026-02-19';
        inp.addEventListener('change', updatePreview);
        group.appendChild(inp);
      } else {
        const div = document.createElement('div');
        div.contentEditable = 'true';
        div.className = 'rich-input dynamic-rich';
        div.setAttribute('data-dyn-name', field.name);
        div.innerHTML = field.defaultVal;
        div.addEventListener('focus', () => trackFocus(div));
        div.addEventListener('input', updatePreview);
        group.appendChild(div);
      }
      dom.dynamicContainer.appendChild(group);
    });
  }

  /* ── preview: collect form data + render the live letter ─────── */
  // Format an ISO date (yyyy-mm-dd) into a formal long form, e.g.
  // "April 1, 2025". Non-ISO or empty values pass through untouched so
  // the templates never show a raw machine date in a finished letter.
  function formatDate(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt)) return iso;
    // Formal DD/MMM/YYYY form, e.g. 19/Feb/2026.
    const mon = dt.toLocaleDateString('en-US', { month: 'short' });
    return `${String(d).padStart(2, '0')}/${mon}/${y}`;
  }

  // Add a whole number of months to an ISO date and return the long form.
  // Used to derive a contract end date from its start date + term.
  function addMonths(iso, months) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || !months) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1 + months, d);
    if (isNaN(dt)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return formatDate(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
  }

  function collectFormData() {
    // Full party name = prefix + first + last (each optional).
    const prefixEl = byId('employeePrefixField');
    const prefix   = prefixEl ? prefixEl.value : '';
    const fullName = [prefix, getRichHTML('employeeFirstField'), getRichHTML('employeeLastField')]
      .map((s) => (s || '').trim()).filter(Boolean).join(' ') || 'Employee';
    // Signatory is "Name, Title"; render the title on its own line.
    const mgrRaw = (dom.managerName.tagName === 'SELECT' ? dom.managerName.value : getRichHTML('managerNameField')) || 'Manager';
    const ci = mgrRaw.indexOf(',');
    const data = {
      letterType:      dom.letterType.value,
      employeeName:    `<strong>${fullName}</strong>`,
      employeeRole:    `<em>${getRichHTML('employeeRoleField') || 'Role'}</em>`,
      managerName:     ci >= 0 ? `<strong>${mgrRaw.slice(0, ci).trim()}</strong><br><em>${mgrRaw.slice(ci + 1).trim()}</em>` : `<strong>${mgrRaw}</strong>`,
      additionalNotes: getRichHTML('additionalNotesField') || '',
      issueDate:       formatDate(dom.issueDate.value),
    };
    document.querySelectorAll('.dynamic-date').forEach((d) => { if (d.name) data[d.name] = formatDate(d.value); });
    document.querySelectorAll('.dynamic-rich').forEach((div) => {
      const name = div.getAttribute('data-dyn-name');
      if (name) data[name] = div.innerHTML;
    });
    // Derive the contract end date from its start date + term in months.
    const startEl = document.querySelector('.dynamic-date[name="startDate"]');
    if (startEl) {
      const months = parseInt(String(data.contractTermMonths || '').replace(/[^\d]/g, ''), 10);
      data.endDate = addMonths(startEl.value, months) || '—';
    }
    return data;
  }

  // Ultra-minimal letterhead, shared by screen preview and print.
  function getLetterhead() {
    return `<div class="letterhead"><div class="lh-row"><div class="lh-ident"><img class="lh-mark" src="${logoDataUrl}" alt=""><span class="lh-name">Kneuralabs</span></div><address class="lh-contact">hello@kneuralabs.com<br>+91 98 741 741 00 / +1 (602) 349 6753<br><a href="https://www.kneuralabs.com">www.kneuralabs.com</a></address></div><hr class="lh-rule"></div>`;
  }

  function updatePreview() {
    const data = collectFormData();
    const tpl  = letterTemplates[data.letterType];
    if (!tpl) return;
    const sysNote = `<div class="letter-sysnote">System-generated by Kneuralabs — valid and binding without a physical signature.</div>`;
    const footer = `<div class="letter-footer">${sysNote}<b>Connecticut</b>&nbsp;345 Buckland Hills Dr, Manchester, CT 06042-8704, USA&nbsp;&nbsp;·&nbsp;&nbsp;<b>Kolkata</b>&nbsp;12/1J Chanditala Lane, Tollygunge, Kolkata 700040, India</div>`;
    dom.preview.innerHTML = getLetterhead() + tpl.template(data) + footer;
    const label = currentTypeLabel();
    dom.liveBadge.innerText = label;
    dom.editorBadge.innerText = label;
  }

  /* ── actions: download as PDF ────────────────────────────────── */
  // The html2canvas/html2pdf path produced reliably BLANK pages (the
  // off-screen clone captured nothing), so the PDF is generated from the
  // browser's own print engine instead: an exact, vector, CDN-free render
  // of the very CSS shown on screen. Edge/Chrome's "Save as PDF" (the
  // default destination) turns it into a downloaded file.
  function downloadPdf() { printToPdf(); }

  // Render a print-ready A4 clone inside a hidden iframe (not a pop-up, so
  // it can't be blocked) and invoke the browser's print → Save as PDF.
  function printToPdf() {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    // Off-screen with a real A4 size so it actually renders (display:none /
    // zero-size iframes print blank); never visible to the user.
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    win.document.open();
    win.document.write(`<!DOCTYPE html><html><head><title>${pdfName()}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  @page{size:A4;margin:0;}
  *{box-sizing:border-box;margin:0;padding:0;}
  html{font-size:16px;}
  body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#fff;width:700px;zoom:1.1339;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .letter-inner{padding:2.4rem 4.2rem 2.6rem;}
  .letterhead{margin-bottom:1.4rem;white-space:normal;break-inside:avoid;}
  .lh-row{display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:1.5rem;margin-bottom:.85rem;}
  .lh-ident{display:flex;align-items:center;gap:.85rem;}
  .lh-mark{width:42px;height:42px;border-radius:9px;display:block;flex-shrink:0;}
  .lh-name{font-family:'Inter','Plus Jakarta Sans',sans-serif;font-size:1.45rem;font-weight:400;letter-spacing:-.02em;color:#12182a;}
  .lh-contact{font-family:'Inter','Plus Jakarta Sans',sans-serif;font-size:.68rem;color:#8892aa;letter-spacing:.02em;line-height:1.8;text-align:right;font-style:normal;}
  .lh-contact a{color:#8892aa;text-decoration:none;}
  .lh-contact b{color:#12182a;font-weight:700;}
  .lh-rule{height:1px;background:#e4e7ef;border:none;display:block;width:100%;}
  .letter-content-display{font-family:'Cormorant Garamond',Georgia,serif;line-height:1.58;font-size:.735rem;color:#1a1e30;white-space:normal;display:flex;flex-direction:column;min-height:905px;}
  .letter-footer{margin-top:auto;padding-top:1.05rem;border-top:1px solid #e4e7ef;font-family:'Inter','Plus Jakarta Sans',sans-serif;font-size:.66rem;color:#8892aa;text-align:center;letter-spacing:.03em;line-height:1.9;break-inside:avoid;}
  .letter-footer b{color:#12182a;font-weight:700;}
  .letter-sysnote{margin-top:1.4rem;padding-top:.85rem;border-top:1px dashed #d6dbe8;font-family:'Inter','Plus Jakarta Sans',sans-serif;font-size:.6rem;font-style:italic;color:#8892aa;line-height:1.6;text-align:center;break-inside:avoid;}
  strong{font-weight:700;}
</style></head><body><div style="height:4px;background:linear-gradient(90deg,#1e57a4 0%,#1e57a4 62%,#c0392b 62%);"></div><div class="letter-inner"><div class="letter-content-display">${dom.preview.innerHTML}</div></div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};<\/script>
</body></html>`);
    win.document.close();
    // Clean up the iframe once the print dialog has had time to open.
    setTimeout(() => { try { document.body.removeChild(iframe); } catch (e) {} }, 60000);
  }

  /* ── mail: config persistence + sending ──────────────────────── */
  // NOTE: IMAP/SMTP credentials cannot be used directly from a browser;
  // they are retained only as display/config values. Sending opens the
  // user's mail client via a mailto: link.
  // Persisted in localStorage in plaintext — do not store real secrets.
  const STORAGE_KEY = 'kneuralabs_mail_config';
  let mailConfig = {
    imapHost: 'imap.secureserver.net', imapUser: '', imapPass: '',
    smtpHost: 'smtpout.secureserver.net', smtpUser: '', smtpPass: '',
    defaultFrom: 'hr@kneuralabs.com'
  };
  // Map of DOM input id -> mailConfig key (id used directly when absent).
  const cfgIds = ['imapHost', 'imapUser', 'imapPass', 'smtpHost', 'smtpUser', 'smtpPass', 'defaultSenderEmail'];
  const cfgKeyMap = { defaultSenderEmail: 'defaultFrom' };
  const cfgKey = (id) => cfgKeyMap[id] || id;

  function loadConfig() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { mailConfig = { ...mailConfig, ...JSON.parse(saved) }; } catch (e) { /* corrupt — keep defaults */ } }
    cfgIds.forEach((id) => {
      const el = byId(id), val = mailConfig[cfgKey(id)];
      if (el && val) el.value = val;
    });
  }

  function saveConfig() {
    cfgIds.forEach((id) => { mailConfig[cfgKey(id)] = byId(id).value; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mailConfig));
  }

  /* ── ui: modal + event wiring ────────────────────────────────── */
  const setModal = (open) => { dom.modal.style.display = open ? 'flex' : 'none'; };
  byId('settingsBtn').addEventListener('click', () => setModal(true));
  byId('closeModalBtn').addEventListener('click', () => setModal(false));
  byId('saveEmailConfigBtn').addEventListener('click', () => { saveConfig(); setModal(false); alert('Settings saved.'); });
  window.addEventListener('click', (e) => { if (e.target === dom.modal) setModal(false); });

  dom.letterType.addEventListener('change', () => {
    rebuildDynamicFields(dom.letterType.value);
    updatePreview();
  });
  byId('downloadPdfBtn').addEventListener('click', downloadPdf);
  document.querySelectorAll('.rich-input').forEach((r) => r.addEventListener('input', updatePreview));
  dom.issueDate.addEventListener('change', updatePreview);
  dom.managerName.addEventListener('change', updatePreview);
  const prefixEl = byId('employeePrefixField');
  if (prefixEl) prefixEl.addEventListener('change', updatePreview);

  /* ── preview scaler: fit fixed 700×990 paper into its pane ───── */
  const paperWrap = document.querySelector('.letter-wrap');
  const paperEl   = document.querySelector('.letter-paper');
  function fitPaper() {
    const stacked = window.innerWidth <= 820;
    const s = stacked
      ? Math.min(paperWrap.clientWidth / 700, 1)
      : Math.min(paperWrap.clientWidth / 700, paperWrap.clientHeight / 990);
    paperEl.style.transform = `scale(${s})`;
    // In stacked (scrollable) layout the wrap must reserve the scaled height.
    paperWrap.style.height = stacked ? `${990 * s + 32}px` : '';
  }
  new ResizeObserver(fitPaper).observe(paperWrap);
  window.addEventListener('resize', fitPaper);

  /* ── bootstrap ───────────────────────────────────────────────── */
  fitPaper();
  rebuildDynamicFields('contract');
  loadConfig();
  updatePreview();
})();
