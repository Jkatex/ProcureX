const procurexTenderAmendmentsStorageKey = 'procurex.tenderAmendments.v1';

function cloneProcurexAmendmentValue(value) {
    try {
        return JSON.parse(JSON.stringify(value ?? null));
    } catch (error) {
        return value;
    }
}

function getProcurexTenderId(tender = {}) {
    return tender.id || tender.reference || tender.tenderReference || '';
}

function readProcurexTenderAmendments() {
    try {
        const parsed = JSON.parse(localStorage.getItem(procurexTenderAmendmentsStorageKey) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        localStorage.removeItem(procurexTenderAmendmentsStorageKey);
        return [];
    }
}

function writeProcurexTenderAmendments(amendments = []) {
    localStorage.setItem(procurexTenderAmendmentsStorageKey, JSON.stringify(amendments));
}

function normalizeProcurexAmendmentDate(value = '') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function normalizeProcurexTenderAmendment(amendment = {}) {
    const createdAt = normalizeProcurexAmendmentDate(amendment.createdAt || new Date().toISOString());
    const status = amendment.status === 'published' ? 'published' : 'draft';
    return {
        id: amendment.id || `amd-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        tenderId: amendment.tenderId || amendment.tenderReference || '',
        title: String(amendment.title || '').trim(),
        reason: String(amendment.reason || '').trim(),
        summary: String(amendment.summary || '').trim(),
        status,
        createdAt,
        publishedAt: status === 'published' ? normalizeProcurexAmendmentDate(amendment.publishedAt || createdAt) : '',
        createdBy: amendment.createdBy || 'Buyer',
        sourceClarificationId: amendment.sourceClarificationId || '',
        affectedSections: Array.isArray(amendment.affectedSections) ? amendment.affectedSections.filter(Boolean) : [],
        changes: amendment.changes && typeof amendment.changes === 'object' ? amendment.changes : {},
        recipients: Array.isArray(amendment.recipients) ? amendment.recipients : []
    };
}

function getTenderAmendments(tenderId = '', options = {}) {
    const includeDrafts = options.includeDrafts !== false;
    return readProcurexTenderAmendments()
        .map(normalizeProcurexTenderAmendment)
        .filter(item => String(item.tenderId) === String(tenderId))
        .filter(item => includeDrafts || item.status === 'published')
        .sort((first, second) => Date.parse(second.publishedAt || second.createdAt) - Date.parse(first.publishedAt || first.createdAt));
}

function saveTenderAmendment(amendment = {}) {
    const normalized = normalizeProcurexTenderAmendment(amendment);
    const amendments = readProcurexTenderAmendments();
    const next = [normalized, ...amendments.filter(item => item.id !== normalized.id)];
    writeProcurexTenderAmendments(next);
    return normalized;
}

function getProcurexAmendmentText(amendment = {}) {
    const changes = amendment.changes || {};
    return [
        changes.generalText,
        changes.requirementNote,
        changes.commercialNote,
        changes.evaluationNote,
        amendment.summary,
        amendment.reason
    ].map(value => String(value || '').trim()).filter(Boolean).join(' ');
}

function getProcurexAmendmentDocumentName(amendment = {}) {
    const safeTitle = String(amendment.title || 'Tender amendment')
        .replace(/[^a-z0-9]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 48) || 'Tender_amendment';
    return `${safeTitle}.pdf`;
}

function getProcurexInterestedSupplierRecipients(tender = {}) {
    const candidates = [
        ...(tender.interestedSuppliers || []),
        ...(tender.invitedSuppliers || []),
        ...(tender.clarifications || []).map(item => ({
            name: item.supplier || item.supplierName || item.senderName || item.company || ''
        }))
    ];
    const seen = new Set();
    const recipients = [];
    candidates.forEach((candidate, index) => {
        const name = String(candidate.name || candidate.organization || candidate.supplier || candidate.company || '').trim();
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        recipients.push({
            id: recipients.length === 0 ? 'user-001' : `supplier-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || index}`,
            name,
            status: candidate.status || 'Interested supplier',
            mailbox: candidate.email || ''
        });
    });
    return recipients;
}

function notifyProcurexTenderAmendment(amendment = {}, tender = {}) {
    if (typeof window.addProcurexCommunicationItem !== 'function') return [];
    const recipients = amendment.recipients?.length ? amendment.recipients : getProcurexInterestedSupplierRecipients(tender);
    return recipients.map(recipient => window.addProcurexCommunicationItem({
        id: `amendment-notice-${amendment.id}-${recipient.id}`,
        kind: 'notification',
        category: 'Tender Amendment',
        subject: `Tender Amendment: ${amendment.title || 'Tender amendment'} - ${tender.id || amendment.tenderId}`,
        body: amendment.summary || amendment.reason || getProcurexAmendmentText(amendment) || 'A tender amendment has been published. Review the updated tender document before submitting your bid.',
        senderId: 'buyer-001',
        senderType: 'Buyer',
        senderName: tender.organization || amendment.createdBy || 'Buyer',
        recipientId: recipient.id || 'user-001',
        recipientType: 'Supplier',
        recipientName: recipient.name || 'Interested supplier',
        tenderId: tender.id || amendment.tenderId,
        tenderReference: tender.id || amendment.tenderId,
        tenderTitle: tender.title || 'Tender amendment',
        priority: 'High',
        status: 'Unread',
        read: false,
        actionRequired: true,
        actionLabel: 'View amendment',
        actionPage: 'tender-detail',
        visibility: 'Interested suppliers',
        attachments: [{ id: `att-${amendment.id}`, name: getProcurexAmendmentDocumentName(amendment), fileType: 'application/pdf' }],
        audience: ['user', 'all']
    }));
}

function publishTenderAmendment(amendmentId = '') {
    const amendments = readProcurexTenderAmendments();
    const existing = amendments.find(item => item.id === amendmentId);
    if (!existing) return null;
    const published = normalizeProcurexTenderAmendment({
        ...existing,
        status: 'published',
        publishedAt: new Date().toISOString()
    });
    writeProcurexTenderAmendments([published, ...amendments.filter(item => item.id !== amendmentId)]);
    const tender = (typeof getProcurexAllTenders === 'function' ? getProcurexAllTenders() : mockData?.tenders || [])
        .find(item => String(getProcurexTenderId(item)) === String(published.tenderId)) || {};
    notifyProcurexTenderAmendment(published, tender);
    return published;
}

function appendUniqueProcurexAmendmentItems(items = [], additions = []) {
    const next = [...items];
    additions.forEach(item => {
        const key = typeof item === 'object'
            ? JSON.stringify(item)
            : String(item || '');
        if (!next.some(existing => (typeof existing === 'object' ? JSON.stringify(existing) : String(existing || '')) === key)) {
            next.push(item);
        }
    });
    return next;
}

function applyProcurexTenderAmendment(effectiveTender = {}, amendment = {}) {
    const changes = amendment.changes || {};
    const amendmentRecord = {
        id: amendment.id,
        title: amendment.title || 'Tender amendment',
        status: amendment.status === 'published' ? 'Published' : 'Draft',
        detail: amendment.summary || amendment.reason || getProcurexAmendmentText(amendment),
        publishedAt: amendment.publishedAt,
        affectedSections: amendment.affectedSections
    };

    effectiveTender.amendments = appendUniqueProcurexAmendmentItems(
        (effectiveTender.amendments || []).filter(item => !/^no amendments published$/i.test(String(item.title || ''))),
        [amendmentRecord]
    );

    if (changes.closingDate) {
        effectiveTender.closingDate = changes.closingDate;
        effectiveTender.milestones = (effectiveTender.milestones || []).map(item => {
            const name = `${item.id || ''} ${item.name || item.title || ''}`.toLowerCase();
            if (name.includes('closing') || name.includes('bid closing')) return { ...item, date: changes.closingDate };
            return item;
        });
    }

    if (changes.documentName) {
        effectiveTender.documents = appendUniqueProcurexAmendmentItems(effectiveTender.documents || [], [changes.documentName]);
    }
    effectiveTender.documents = appendUniqueProcurexAmendmentItems(effectiveTender.documents || [], [getProcurexAmendmentDocumentName(amendment)]);

    if (changes.requirementNote) {
        effectiveTender.requirements = {
            ...(effectiveTender.requirements || {}),
            lists: {
                ...(effectiveTender.requirements?.lists || {}),
                amendmentRequirements: appendUniqueProcurexAmendmentItems(effectiveTender.requirements?.lists?.amendmentRequirements || [], [{ text: changes.requirementNote }])
            }
        };
    }

    if (changes.commercialItemDescription || changes.commercialNote) {
        const item = {
            item: changes.commercialItemCode || `AMD-${(effectiveTender.commercialItems || []).length + 1}`,
            description: changes.commercialItemDescription || changes.commercialNote,
            qty: Number(changes.commercialItemQty || 1),
            unit: changes.commercialItemUnit || 'Lot',
            rate: Number(changes.commercialItemRate || 0)
        };
        effectiveTender.commercialItems = appendUniqueProcurexAmendmentItems(effectiveTender.commercialItems || [], [item]);
        effectiveTender.boqItems = appendUniqueProcurexAmendmentItems(effectiveTender.boqItems || [], [item]);
    }

    if (changes.evaluationCriterionName || changes.evaluationNote) {
        effectiveTender.evaluation = {
            ...(effectiveTender.evaluation || {}),
            criteria: appendUniqueProcurexAmendmentItems(effectiveTender.evaluation?.criteria || [], [{
                name: changes.evaluationCriterionName || 'Amended evaluation instruction',
                weight: Number(changes.evaluationCriterionWeight || 0),
                subcriteria: [changes.evaluationNote || amendment.summary || 'Review amendment notice'].filter(Boolean)
            }])
        };
    }

    if (changes.generalText) {
        effectiveTender.amendmentAddendumText = appendUniqueProcurexAmendmentItems(effectiveTender.amendmentAddendumText || [], [changes.generalText]);
    }

    return effectiveTender;
}

function getEffectiveTender(tender = {}) {
    const tenderId = getProcurexTenderId(tender);
    const effectiveTender = cloneProcurexAmendmentValue(tender) || {};
    getTenderAmendments(tenderId, { includeDrafts: false })
        .slice()
        .reverse()
        .forEach(amendment => applyProcurexTenderAmendment(effectiveTender, amendment));
    return effectiveTender;
}

window.getTenderAmendments = getTenderAmendments;
window.saveTenderAmendment = saveTenderAmendment;
window.publishTenderAmendment = publishTenderAmendment;
window.getEffectiveTender = getEffectiveTender;
window.getProcurexInterestedSupplierRecipients = getProcurexInterestedSupplierRecipients;
window.getProcurexAmendmentDocumentName = getProcurexAmendmentDocumentName;
window.procurexTenderAmendmentsStorageKey = procurexTenderAmendmentsStorageKey;
