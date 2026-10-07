import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, getUser } from '../services/api';
import { ErrorBox, FaceAvatar, Loading, Modal, PageHeader, SearchableSelect, initialsOf } from '../components/Ui';
import BrandIcon from '../components/BrandIcon';
import { can, isMaster, isSubMaster, isNagarsevak, roleOf } from '../rbac';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';

function isAllChat(g) { return g?.type === 'WARD' || g?.channel === 'ALL'; }

function groupTitle(g) {
  if (isAllChat(g)) return g.ward ? formatWardLabel(g.ward, g.name || 'All chat') : (g.name || 'All chat');
  if (g.type === 'NAGARSEVAK') return g.nagarsevak?.name || g.name || 'Nagarsevak';
  return g.name;
}

function groupSubtitle(g, isMr) {
  if (isAllChat(g)) return isMr ? 'सर्व चॅट · प्रभागातील सर्व नागरिक' : 'All chat · everyone in this ward';
  if (g.type === 'NAGARSEVAK') return isMr ? 'नगरसेवक गट · प्रभाग सदस्य' : 'Nagarsevak group · ward members';
  return g.mode === 'BROADCAST' 
    ? (isMr ? 'प्रसारण गट' : 'Broadcast group') 
    : (isMr ? 'समुदाय गट' : 'Community group');
}

function lastPreview(m, isMr, currentUserId) {
  if (!m) return isMr ? 'संदेश उपलब्ध नाही' : 'No messages yet';
  const prefix = String(m.senderUserId) === String(currentUserId) ? '✓✓ ' : '';
  if (m.messageType === 'IMAGE') return `${prefix}📷 ${isMr ? 'फोटो' : 'Photo'}`;
  if (m.messageType === 'VIDEO') return `${prefix}🎬 ${isMr ? 'व्हिडिओ' : 'Video'}`;
  if (m.messageType === 'PDF') return `${prefix}📄 ${m.content || (isMr ? 'दस्तऐवज' : 'Document')}`;
  return `${prefix}${m.content || (isMr ? 'संदेश' : 'Message')}`;
}

function senderColor(name, id) {
  const colors = [
    '#059669', '#0284c7', '#7c3aed', '#db2777', 
    '#ea580c', '#10b981', '#d97706', '#4f46e5',
    '#0891b2', '#e11d48', '#2563eb', '#15803d'
  ];
  const str = String(id || name || 'User');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatChatDate(dateStr, isMr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (isNaN(d.getTime())) return '';
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return isMr ? 'आज' : 'TODAY';
  if (isYesterday) return isMr ? 'काल' : 'YESTERDAY';
  return d.toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatMsgTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatWhatsAppListItemDate(dateStr, isMr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return formatMsgTime(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return isMr ? 'काल' : 'Yesterday';
  }
  return d.toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? '2-digit' : undefined
  });
}

function formatBubbleTimestamp(dateStr, isMr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = formatMsgTime(dateStr);
  if (isToday) return time;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const dayPrefix = isYesterday ? (isMr ? 'काल, ' : 'Yesterday, ') : `${d.toLocaleDateString(isMr ? 'mr-IN' : 'en-IN', { day: 'numeric', month: 'short' })}, `;
  return `${dayPrefix}${time}`;
}

function SenderRoleBadge({ sender, isMr }) {
  const role = String(sender?.Role?.name || sender?.role || '').toUpperCase();
  if (role === 'NAGARSEVAK') {
    return <span className="wa-role-badge nagar">{isMr ? 'नगरसेवक' : 'Nagarsevak'}</span>;
  }
  if (role === 'EMPLOYEE') {
    return <span className="wa-role-badge emp" title={isMr ? 'प्रभाग कार्यकर्ता (नगरसेवक कार्यालय)' : 'Ward Worker (under Nagarsevak)'}>🏷️ {isMr ? 'कार्यकर्ता' : 'Ward Worker'}</span>;
  }
  if (role === 'SUPER_ADMIN' || role === 'SUB_MASTER_ADMIN') {
    return <span className="wa-role-badge admin">🛡️ {isMr ? 'अ‍ॅडमिन' : 'Admin'}</span>;
  }
  return null;
}

function GroupFace({ g }) {
  if (isAllChat(g)) return <span className="wa-avatar community notranslate" translate="no"><BrandIcon size={28} variant="dark" /></span>;
  if (g.type === 'NAGARSEVAK') return <FaceAvatar name={g.nagarsevak?.name || groupTitle(g)} photo={g.nagarsevak?.photo} className="wa-avatar nagar" />;
  return <span className="wa-avatar notranslate" translate="no">{initialsOf(groupTitle(g))}</span>;
}

function GroupPage() {
  const user = getUser();
  const master = isMaster(user), sub = isSubMaster(user), councillor = isNagarsevak(user), citizen = roleOf(user) === 'CITIZEN', isEmp = roleOf(user) === 'EMPLOYEE';
  const canViewCitizenMobile = master || sub || councillor || isEmp;
  const canViewResidentDetails = canViewCitizenMobile;
  const { wards, selectedWardId: scopedWardId, canSelect } = useWardFilter();
  const canCreate = can('CREATE_CHAT_GROUP', user) || master;
  
  const [language, setLanguage] = useState(() => localStorage.getItem('ward_language') || 'en');
  useEffect(() => {
    const handler = () => setLanguage(localStorage.getItem('ward_language') || 'en');
    window.addEventListener('languagechange', handler);
    window.addEventListener('storage', handler);
    window.addEventListener('ward:language-changed', handler);
    return () => {
      window.removeEventListener('languagechange', handler);
      window.removeEventListener('storage', handler);
      window.removeEventListener('ward:language-changed', handler);
    };
  }, []);
  const isMr = language === 'mr';

  const [groups, setGroups] = useState(null);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [compose, setCompose] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState(null);
  const [selectedResidentName, setSelectedResidentName] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxImage) {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  function openResidentModal(userId, name) {
    if (!canViewResidentDetails || !userId) return;
    setSelectedResidentId(userId);
    setSelectedResidentName(name || '');
  }

  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('ward_groups_filters') || '{}'); } catch { return {}; } })();
  const defaultWardId = citizen || councillor || isEmp 
    ? (user?.wardId || user?.ward?.id || saved.wardId || '') 
    : (saved.wardId || scopedWardId || (!canSelect ? (user?.wardId || user?.ward?.id || '') : ''));
  const [wardId, setWardId] = useState(defaultWardId);
  const [nagarsevakId, setNagarsevakId] = useState(saved.nagarsevakId || '');
  const [groupId, setGroupId] = useState(saved.groupId || '');
  const [search, setSearch] = useState(saved.search || '');
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState({ name: user?.wardId ? '' : '', wardId: user?.wardId || '', mode: 'CHAT' });

  const fileRef = useRef(null);
  const bottom = useRef(null);
  const messagesScrollRef = useRef(null);
  const textareaRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const loadingGroupsRef = useRef(false);
  const [searchParams] = useSearchParams();

  const handleMessagesScroll = (e) => {
    const el = e.currentTarget;
    if (!el) return;
    const threshold = 140; // px threshold from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= threshold;
  };

  useEffect(() => {
    const next = citizen || councillor || isEmp 
      ? (user?.wardId || user?.ward?.id || '') 
      : (scopedWardId || (!canSelect ? (user?.wardId || user?.ward?.id || '') : ''));
    if (next && String(next) !== String(wardId)) setWardId(String(next));
  }, [scopedWardId, canSelect, citizen, councillor, isEmp, user?.wardId, user?.ward?.id, wardId]);

  useEffect(() => {
    try { sessionStorage.setItem('ward_groups_filters', JSON.stringify({ wardId, nagarsevakId, groupId, search })); } catch {}
  }, [wardId, nagarsevakId, groupId, search]);

  const loadGroups = (id = wardId) => {
    if (loadingGroupsRef.current) return Promise.resolve();
    loadingGroupsRef.current = true;
    return api.chatGroups(id ? { wardId: id } : {})
      .then(r => {
        setGroups(r.data || []);
      })
      .catch(e => {
        setError(e.message || (isMr ? 'चॅट लोड करणे शक्य झाले नाही.' : 'Unable to load chats.'));
        setGroups([]);
      })
      .finally(() => {
        loadingGroupsRef.current = false;
      });
  };

  useEffect(() => { loadGroups(wardId); }, [wardId]);
  useEffect(() => {
    if (!wardId) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadGroups(wardId);
    }, 20000);
    return () => clearInterval(t);
  }, [wardId]);

  const accessibleGroups = useMemo(() => {
    if (!wardId) return [];
    const base = (groups || []).filter(g => String(g.wardId) === String(wardId));
    return base.filter(g => {
      if (citizen || isEmp) return isAllChat(g) || g.type === 'NAGARSEVAK';
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return [g.name, g.ward?.wardNumber, g.ward?.name, g.nagarsevak?.name].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    }).sort((a, b) => {
      const rank = g => isAllChat(g) ? 0 : g.type === 'NAGARSEVAK' ? 1 : 2;
      return rank(a) - rank(b) || groupTitle(a).localeCompare(groupTitle(b));
    });
  }, [groups, wardId, search, citizen, isEmp]);

  const nagarsevaks = useMemo(() => {
    const map = new Map();
    (groups || []).filter(g => g.type === 'NAGARSEVAK' && (!wardId || String(g.wardId) === String(wardId))).forEach(g => {
      const n = g.nagarsevak;
      if (n?.id && !map.has(n.id)) map.set(n.id, { id: n.id, name: n.name, wardId: g.wardId, ward: g.ward });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, wardId]);

  const filteredGroups = useMemo(() => {
    return accessibleGroups.filter(g => {
      if (citizen || isEmp) return true;
      if (councillor && g.type === 'NAGARSEVAK' && String(g.nagarsevakUserId) !== String(user?.id)) return false;
      if (councillor && g.type === 'CUSTOM') return false;
      if (nagarsevakId && !(g.type === 'NAGARSEVAK' && String(g.nagarsevakUserId) === String(nagarsevakId))) return false;
      if (groupId && String(g.id) !== String(groupId)) return false;
      return true;
    });
  }, [accessibleGroups, nagarsevakId, groupId, citizen, isEmp, councillor, user?.id]);

  const displayedGroups = filteredGroups;

  const groupOptions = useMemo(() => {
    const source = nagarsevakId
      ? accessibleGroups.filter(g => g.type === 'NAGARSEVAK' && String(g.nagarsevakUserId) === String(nagarsevakId))
      : accessibleGroups;
    return source.map(g => ({
      value: String(g.id),
      label: `${groupTitle(g)} · ${isAllChat(g) ? 'All chat' : g.type === 'NAGARSEVAK' ? 'Nagarsevak group' : 'Group'}`
    }));
  }, [accessibleGroups, nagarsevakId]);

  useEffect(() => {
    if (nagarsevakId && !nagarsevaks.some(n => String(n.id) === String(nagarsevakId))) setNagarsevakId('');
  }, [nagarsevaks, nagarsevakId]);

  useEffect(() => {
    if (groupId && !filteredGroups.some(g => String(g.id) === String(groupId))) setGroupId('');
  }, [filteredGroups, groupId]);

  useEffect(() => {
    if (!filteredGroups.length) { setActive(null); return; }
    const requested = searchParams.get('group');
    if (requested) {
      const requestedGroup = filteredGroups.find(g => String(g.id) === String(requested));
      if (requestedGroup) { setActive(requestedGroup); setChatOpen(true); return; }
    }
    setActive(a => {
      if (a && filteredGroups.some(g => g.id === a.id)) return filteredGroups.find(g => g.id === a.id);
      if (typeof window !== 'undefined' && window.matchMedia('(max-width:800px)').matches) return null;
      return filteredGroups[0];
    });
  }, [filteredGroups, searchParams]);

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    setPendingAttachment(null);
    let live = true;
    const load = () => api.chatMessages(active.id, { limit: 100 })
      .then(r => { if (live) setMessages(r.data || []); })
      .catch(e => { if (live) setError(e.message); });
    load();
    api.markChatRead(active.id)
      .then(() => window.dispatchEvent(new CustomEvent('ward:chat-refresh')))
      .catch(() => {});
    const t = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      load();
    }, 8000);
    return () => { live = false; clearInterval(t); };
  }, [active?.id]);

  useEffect(() => {
    // When active chat changes, immediately scroll to bottom
    isNearBottomRef.current = true;
    const scrollDown = () => {
      if (messagesScrollRef.current) {
        messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
      } else {
        bottom.current?.scrollIntoView({ behavior: 'auto' });
      }
    };
    scrollDown();
    const t = setTimeout(scrollDown, 80);
    return () => clearTimeout(t);
  }, [active?.id]);

  useEffect(() => {
    // Only smooth scroll to bottom if user is already near the bottom (prevents scroll jumps while reading older messages)
    if (!messagesScrollRef.current) return;
    if (isNearBottomRef.current) {
      messagesScrollRef.current.scrollTo({
        top: messagesScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages.length]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [compose]);

  async function createGroup(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api.createChatGroup(form);
      setCreate(false);
      setForm({ name: '', wardId: wardId || user?.wardId || '', mode: 'CHAT' });
      await loadGroups();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!active || (!compose.trim() && !pendingAttachment)) return;
    setBusy(true); setError('');
    try {
      if (pendingAttachment) {
        await api.sendChatMessage(active.id, {
          messageType: pendingAttachment.type,
          content: pendingAttachment.name || (pendingAttachment.type === 'PDF' ? 'Document.pdf' : ''),
          imageMime: pendingAttachment.mime,
          imageData: pendingAttachment.data
        });
      }
      if (compose.trim()) {
        await api.sendChatMessage(active.id, { messageType: 'TEXT', content: compose.trim() });
      }
      setCompose('');
      setPendingAttachment(null);
      if (fileRef.current) fileRef.current.value = '';
      const r = await api.chatMessages(active.id, { limit: 100 });
      setMessages(r.data || []);
      isNearBottomRef.current = true;
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
        }
      }, 50);
      await api.markChatRead(active.id).catch(() => {});
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function chooseAttachment(file) {
    if (!active || !file) return;
    setError('');
    const name = file.name || '';
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const isDoc = file.type === 'application/pdf' || /\.(pdf|docx?|xlsx?|pptx?|txt|csv)$/i.test(name) || /application\/(msword|vnd\.openxmlformats|vnd\.ms-|text\/plain|text\/csv)/i.test(file.type);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(name);
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isDoc && !isVideo) {
      setError(isMr ? 'कृपया फोटो, व्हिडिओ (MP4/WEBM/MOV) किंवा दस्तऐवज (PDF/DOC/XLS/PPT) निवडा.' : 'Please select a photo, video (MP4/WEBM/MOV) or document (PDF/DOC/XLS/PPT).');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError(isMr ? 'फाइल १२ MB पेक्षा लहान असावी.' : 'Attachment must be smaller than 12 MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    try {
      if (isImage) {
        const data = await readImage(file);
        setPendingAttachment({ data, name: name || 'Photo.jpg', type: 'IMAGE', mime: 'image/jpeg' });
      } else if (isVideo) {
        let data = await readFileData(file);
        const mime = file.type === 'video/quicktime' || /\.mov$/i.test(name) ? 'video/quicktime' : file.type === 'video/webm' ? 'video/webm' : 'video/mp4';
        if (typeof data === 'string' && !/^data:video\//i.test(data)) {
          const payload = String(data).split(',')[1] || '';
          data = `data:${mime};base64,${payload}`;
        }
        setPendingAttachment({ data, name: name || 'Video.mp4', type: 'VIDEO', mime });
      } else {
        const data = await readFileData(file);
        const mime = file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream');
        setPendingAttachment({ data, name: name || 'Document.pdf', type: 'PDF', mime });
      }
    } catch (e) {
      setError(isMr ? 'निवडलेली फाइल वाचणे शक्य झाले नाही.' : 'Could not read the selected attachment.');
    }
  }

  async function removeGroup(g) {
    if (!window.confirm(isMr ? `“${g.name}” संग्रहित करायचा आहे का?` : `Archive “${g.name}”?`)) return;
    setBusy(true);
    try {
      await api.deleteChatGroup(g.id);
      await loadGroups();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function clearMyChat() {
    if (!active) return;
    setClearModalOpen(true);
  }

  async function executeClearChat() {
    if (!active) return;
    setClearing(true);
    setError('');
    try {
      await api.clearChat(active.id);
      setMessages([]);
      setClearModalOpen(false);
      setGroups(rows => (rows || []).map(x => x.id === active.id ? { ...x, lastMessage: null, unreadCount: 0 } : x));
    } catch (e) {
      setError(e.message || (isMr ? 'चॅट साफ करणे शक्य झाले नाही.' : 'Unable to clear chat.'));
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      setClearModalOpen(false);
      setCameraModalOpen(false);
      setSelectedResidentId(null);
      if (typeof window !== 'undefined' && window.innerWidth <= 800) {
        setChatOpen(false);
        setActive(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!chatOpen && typeof window !== 'undefined' && window.innerWidth <= 800) {
      setClearModalOpen(false);
      setCameraModalOpen(false);
      setSelectedResidentId(null);
    }
  }, [chatOpen]);

  useEffect(() => {
    setClearModalOpen(false);
    setCameraModalOpen(false);
    setSelectedResidentId(null);
  }, [active?.id]);

  useEffect(() => {
    if (chatOpen && typeof window !== 'undefined' && window.innerWidth <= 800) {
      document.body.classList.add('chat-modal-open');
      document.documentElement.classList.add('chat-modal-open');
      return () => {
        document.body.classList.remove('chat-modal-open');
        document.documentElement.classList.remove('chat-modal-open');
      };
    }
  }, [chatOpen]);

  function openGroup(g) {
    setClearModalOpen(false);
    setCameraModalOpen(false);
    setSelectedResidentId(null);
    setActive(g);
    setChatOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth <= 800) {
      try { window.history.pushState({ chatOpen: true }, ''); } catch {}
    }
    api.markChatRead(g.id).then(() => window.dispatchEvent(new CustomEvent('ward:chat-refresh'))).catch(() => {});
    setGroups(rows => (rows || []).map(x => x.id === g.id ? { ...x, unreadCount: 0 } : x));
  }

  function handleBack(e) {
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch {}
    }
    setClearModalOpen(false);
    setCameraModalOpen(false);
    setSelectedResidentId(null);
    if (typeof window !== 'undefined' && window.innerWidth <= 800) {
      setChatOpen(false);
      setActive(null);
      if (window.history.state?.chatOpen) {
        window.history.back();
      }
    } else {
      setChatOpen(false);
    }
  }

  const wardOptions = wards.map(w => ({ value: String(w.id), label: formatWardLabel(w) }));
  const nagOptions = nagarsevaks.map(n => ({ value: String(n.id), label: `${n.name}${n.ward ? ` · ${formatWardLabel(n.ward, '')}` : ''}` }));
  const canSend = active?.isMember && ((active.mode !== 'BROADCAST') || active.canManage || master);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 800;
  const isChatVisible = Boolean(active && (!isMobile || chatOpen));

  if (!groups) {
    return (
      <div className="groups-page">
        <PageHeader kicker={isMr ? 'चॅट' : 'Chat'} title={isMr ? 'सर्व चॅट व गट' : 'All chat & Groups'} />
        <Loading />
      </div>
    );
  }

  if (error && !groups.length) {
    return (
      <div className="groups-page">
        <PageHeader kicker={isMr ? 'चॅट' : 'Chat'} title={isMr ? 'सर्व चॅट व गट' : 'All chat & Groups'} />
        <ErrorBox error={error} />
        <button type="button" className="small-btn" onClick={() => { setError(''); setGroups(null); loadGroups(); }}>
          {isMr ? 'पुन्हा प्रयत्न करा' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div className={`groups-page wa-page-container ${chatOpen ? 'chat-open' : ''}`}>
      <PageHeader 
        kicker={isMr ? 'चॅट' : 'Chat'} 
        title={isMr ? 'सर्व चॅट व गट' : 'All chat & Groups'} 
        action={canCreate ? <button className="primary-btn" onClick={() => setCreate(true)}>+ {isMr ? 'नवीन गट तयार करा' : 'Create group'}</button> : null}
      />
      
      <ErrorBox error={error} />

      {!citizen && !councillor && !isEmp && (
        <>
          <div className="group-filters">
            <SearchableSelect 
              label={isMr ? 'प्रभाग' : 'Ward'} 
              value={wardId} 
              onChange={v => { setWardId(v); setNagarsevakId(''); setGroupId(''); }} 
              options={wardOptions} 
              disabled={!canSelect} 
              placeholder={canSelect ? (isMr ? 'प्रथम प्रभाग निवडा…' : 'Select ward first…') : (isMr ? 'नियुक्त प्रभाग' : 'Assigned ward')} 
            />
            <SearchableSelect 
              label={isMr ? 'नगरसेवक' : 'Nagarsevak'} 
              value={nagarsevakId} 
              onChange={v => { setNagarsevakId(v); setGroupId(''); }} 
              options={[{ value: '', label: isMr ? 'सर्व नगरसेवक' : 'All Nagarsevaks' }, ...nagOptions]} 
              placeholder={isMr ? 'सर्व नगरसेवक' : 'All Nagarsevaks'} 
            />
            <SearchableSelect 
              label={isMr ? 'गट' : 'Group'} 
              value={groupId} 
              onChange={setGroupId} 
              options={[{ value: '', label: nagarsevakId ? (isMr ? 'या नगरसेवकाचे सर्व गट' : 'All groups for this Nagarsevak') : (isMr ? 'या प्रभागातील सर्व गट' : 'All groups in this ward') }, ...groupOptions]} 
              disabled={!wardId} 
              placeholder={isMr ? 'या प्रभागातील सर्व गट' : 'All groups in this ward'} 
            />
            <label className="group-filter-search">
              {isMr ? 'शोधा' : 'Search'}
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isMr ? 'गट किंवा नगरसेवक शोधा…' : 'Search group / Nagarsevak…'} />
            </label>
          </div>
          {!wardId && <div className="info-note">{isMr ? 'गट पाहण्यासाठी प्रथम प्रभाग निवडा.' : 'Select a Ward first to view its groups.'}</div>}
        </>
      )}

      <div className="group-layout wa-chat">
        {/* LEFT PANE / CHAT LIST (WhatsApp Sidebar) */}
        <aside className="group-list wa-sidebar">
          <div className="wa-sidebar-header">
            <div className="wa-sidebar-user">
              <FaceAvatar name={user?.name} photo={user?.photo} className="wa-sidebar-avatar" />
              <div className="wa-sidebar-user-copy">
                <strong className="notranslate" translate="no">{user?.name || (isMr ? 'वापरकर्ता' : 'User')}</strong>
                <span>
                  {isEmp 
                    ? (isMr ? '🏷️ प्रभाग कार्यकर्ता (नगरसेवक कार्यालय)' : '🏷️ Ward Worker') 
                    : councillor 
                      ? (isMr ? 'नगरसेवक' : 'Nagarsevak') 
                      : (isMr ? 'प्रभाग चॅट' : 'Ward Chat')}
                </span>
              </div>
            </div>

            <div className="wa-search-wrap">
              <span className="wa-search-icon" aria-hidden="true">🔍</span>
              <input 
                className="wa-search-input" 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder={isMr ? 'शोधा किंवा नवीन चॅट…' : 'Search or start new chat…'} 
              />
              {search && (
                <button type="button" className="wa-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="wa-items-container">
            {(() => {
              if (!wardId) return <div className="group-no-items">{isMr ? 'चॅट पाहण्यासाठी प्रभाग निवडा.' : 'Select a ward to view its chats.'}</div>;
              if (!displayedGroups.length) {
                return (
                  <div className="group-no-items">
                    {search.trim() 
                      ? (isMr ? 'कोणतेही चॅट सापडले नाही.' : 'No matching chats found.') 
                      : (isMr ? 'या प्रभागात अजून कोणतेही चॅट नाहीत.' : 'No chats in this ward yet.')}
                  </div>
                );
              }

              return displayedGroups.map(g => {
                const last = (messages.length && active?.id === g.id) ? messages[messages.length - 1] : (g.lastMessage || null);
                const unread = Number(g.unreadCount || 0);

                return (
                  <button 
                    key={g.id} 
                    type="button"
                    className={`group-item wa-item ${active?.id === g.id ? 'active' : ''} ${unread > 0 ? 'has-unread' : ''}`} 
                    onClick={() => openGroup(g)}
                  >
                    <div className="wa-avatar-wrap">
                      <GroupFace g={g} />
                    </div>
                    <div className="wa-item-copy">
                      <div className="wa-item-row-top">
                        <strong className="wa-item-title notranslate" translate="no">{groupTitle(g)}</strong>
                        {last?.createdAt && (
                          <span className="wa-item-time">{formatWhatsAppListItemDate(last.createdAt, isMr)}</span>
                        )}
                      </div>
                      <div className="wa-item-row-bottom">
                        <small className="wa-item-preview">
                          {last ? lastPreview(last, isMr, user?.id) : groupSubtitle(g, isMr)}
                        </small>
                        {unread > 0 && (!chatOpen || active?.id !== g.id) && (
                          <span className="wa-unread-badge">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
        </aside>

        {/* RIGHT PANE / ACTIVE CONVERSATION (WhatsApp Conversation Screen) */}
        <section className="group-chat-panel wa-conversation-panel">
          {!active ? (
            <div className="group-empty wa-empty-conversation">
              <div className="wa-empty-icon">💬</div>
              <h3>{isMr ? 'वॉर्ड चॅट व गट' : 'Ward Desk Messenger'}</h3>
              <p>
                {isMr 
                  ? 'चॅटिंग सुरू करण्यासाठी डावीकडील कोणत्याही चॅटवर किंवा नगरसेवकावर क्लिक करा.' 
                  : 'Select a chat or Nagarsevak group from the list to start messaging.'}
              </p>
              <div className="wa-empty-shield">
                <span>🔒 {isMr ? 'सुरक्षित चॅट · ७५ दिवसांनंतर मेसेज आपोआप कायमचे नष्ट होतात (रिसायकल बिनमध्ये जात नाहीत)' : 'Secure Chat · Messages automatically permanently delete after 75 days (do not move to Recycle Bin)'}</span>
              </div>
            </div>
          ) : (
            <>
              {/* WhatsApp-Style Header */}
              <header className="group-chat-header wa-chat-header">
                <button 
                  type="button" 
                  className="wa-back-btn" 
                  onClick={handleBack} 
                  aria-label={isMr ? 'मागे जा' : 'Back to chats'}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>

                <div className="wa-head-avatar-wrap">
                  <GroupFace g={active} />
                </div>

                <div className="wa-head-copy">
                  <h2 className="notranslate wa-head-title" translate="no">{groupTitle(active)}</h2>
                  <div className="wa-head-subtitle">
                    {active.type === 'NAGARSEVAK' ? (
                      <span>{isMr ? 'नगरसेवक गट' : 'Nagarsevak Group'}{active.ward ? ` · ${formatWardNumber(active.ward.wardNumber, isMr ? 'mr' : 'en')}` : ''}</span>
                    ) : (
                      <span>
                        {isAllChat(active) 
                          ? (isMr ? 'सर्व चॅट · प्रभाग समुदाय' : 'All chat · Ward Community') 
                          : (active.mode === 'BROADCAST' ? (isMr ? 'प्रसारण गट' : 'Broadcast group') : (isMr ? 'समुदाय गट' : 'Community group'))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="wa-header-actions">
                  {(active.isMember || master || sub || active.type !== 'CUSTOM') && (
                    <button 
                      type="button" 
                      className="wa-header-btn wa-clear-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setClearModalOpen(true);
                      }} 
                      title={isMr ? 'चॅट साफ करा' : 'Clear chat'}
                      aria-label={isMr ? 'चॅट साफ करा' : 'Clear chat'}
                    >
                      <span className="wa-btn-icon">🗑️</span>
                      <span className="wa-btn-text">{isMr ? 'साफ करा' : 'Clear'}</span>
                    </button>
                  )}

                  {active.type === 'CUSTOM' && active.isMember && (
                    <button className="wa-header-btn wa-leave-btn" onClick={() => api.leaveChatGroup(active.id).then(loadGroups).catch(e => setError(e.message))}>
                      {isMr ? 'बाहेर पडा' : 'Leave'}
                    </button>
                  )}

                  {active.type === 'CUSTOM' && !active.isMember && (
                    <button className="wa-header-btn wa-join-btn" onClick={() => api.joinChatGroup(active.id).then(loadGroups).catch(e => setError(e.message))}>
                      {isMr ? 'सामील व्हा' : 'Join'}
                    </button>
                  )}

                  {active.canManage && active.type === 'CUSTOM' && (
                    <button className="wa-header-btn wa-archive-btn" onClick={() => removeGroup(active)}>
                      {isMr ? 'संग्रहित' : 'Archive'}
                    </button>
                  )}
                </div>
              </header>

              {/* WhatsApp Messages Scroll Area */}
              <div className="group-messages wa-messages" ref={messagesScrollRef} onScroll={handleMessagesScroll}>

                {!active.isMember ? (
                  <div className="group-empty">
                    {isMr ? 'मेसेज पाहण्यासाठी आणि पाठवण्यासाठी या गटात सामील व्हा.' : 'Join this group to view and send messages.'}
                  </div>
                ) : !messages.length ? (
                  <div className="group-empty">
                    <span style={{ fontSize: '32px', marginBottom: '8px' }}>👋</span>
                    <strong>{isMr ? 'अद्याप कोणतेही संदेश नाहीत.' : 'No messages yet.'}</strong>
                    <small>{isMr ? 'गटाला पहिला संदेश पाठवून सुरुवात करा.' : 'Say hello to the group.'}</small>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const mine = String(m.senderUserId) === String(user?.id);
                    const senderName = m.sender?.name || m.sender?.person?.fullName || (isMr ? 'नागरिक' : 'Citizen');
                    const senderPhoto = m.sender?.photo || (String(m.senderUserId) === String(active?.nagarsevakUserId) ? active?.nagarsevak?.photo : '');
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isDifferentDate = !prevMsg || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
                    const nameColor = senderColor(senderName, m.senderUserId);
                    const senderRole = String(m.sender?.Role?.name || m.sender?.role || '').toUpperCase();
                    const isSenderNagarsevak = senderRole === 'NAGARSEVAK' || String(m.senderUserId) === String(active?.nagarsevakUserId);
                    const isSenderEmployee = ['EMPLOYEE', 'FIELD_EMPLOYEE'].includes(senderRole);
                    const isSenderStaff = ['SUPER_ADMIN', 'SUB_MASTER_ADMIN'].includes(senderRole) || isSenderNagarsevak || isSenderEmployee;
                    const isSenderCitizen = !isSenderStaff;

                    return (
                      <React.Fragment key={m.id}>
                        {isDifferentDate && (
                          <div className="wa-date-divider">
                            <span>{formatChatDate(m.createdAt, isMr)}</span>
                          </div>
                        )}
                        <div className={`group-message wa-message-row ${mine ? 'mine' : 'theirs'}`}>
                          <div className={`group-bubble wa-bubble ${mine ? 'mine' : 'theirs'}`}>
                            {!mine && (
                              <div className="wa-bubble-head">
                                <FaceAvatar name={senderName} photo={senderPhoto} className="wa-bubble-avatar" />
                                <div className="wa-bubble-sender-meta">
                                  {/* Sender name: Nagarsevak and Admin can view details of citizens AND employees; Employee can view citizens */}
                                  {((master || sub || councillor) && (isSenderCitizen || isSenderEmployee)) || (isEmp && isSenderCitizen) ? (
                                    <button
                                      type="button"
                                      className="wa-sender-name-btn notranslate"
                                      translate="no"
                                      style={{ color: nameColor }}
                                      onClick={() => openResidentModal(m.senderUserId || m.sender?.id, senderName)}
                                      title={isMr ? `${senderName} यांचे सर्व तपशील पहा (क्लिक करा)` : `Click to view details of ${senderName}`}
                                    >
                                      {senderName}
                                    </button>
                                  ) : (
                                    <strong className="notranslate wa-sender-name" translate="no" style={{ color: nameColor }}>
                                      {senderName}
                                    </strong>
                                  )}
                                  <SenderRoleBadge sender={m.sender} isMr={isMr} />
                                  {/* Mobile visibility rule:
                                      - Admin, Nagarsevak, and Employee can see everyone's mobile in ward
                                      - Citizen can ONLY see Nagarsevak's mobile */}
                                  {m.sender?.mobile && (
                                    (master || sub || councillor || isEmp) ||
                                    (citizen && isSenderNagarsevak)
                                  ) && (
                                    <a 
                                      href={`tel:${m.sender.mobile}`} 
                                      className="wa-sender-mobile notranslate" 
                                      translate="no" 
                                      title={isMr ? `${senderName} यांना कॉल करा` : `Call ${senderName}`}
                                    >
                                      📞 {m.sender.mobile}
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="wa-bubble-body">
                              {m.messageType === 'IMAGE' ? (
                                <ChatAttachment 
                                  groupId={active.id} 
                                  messageId={m.id} 
                                  type="IMAGE" 
                                  fileName={m.content} 
                                  messageDate={m.createdAt} 
                                  isMr={isMr} 
                                  onOpenImage={(url, name, date) => setLightboxImage({ url, name, date })} 
                                />
                              ) : m.messageType === 'VIDEO' ? (
                                <ChatAttachment 
                                  groupId={active.id} 
                                  messageId={m.id} 
                                  type="VIDEO" 
                                  fileName={m.content} 
                                  messageDate={m.createdAt} 
                                  isMr={isMr} 
                                />
                              ) : m.messageType === 'PDF' ? (
                                <ChatAttachment 
                                  groupId={active.id} 
                                  messageId={m.id} 
                                  type="PDF" 
                                  fileName={m.content} 
                                  messageDate={m.createdAt} 
                                  isMr={isMr} 
                                />
                              ) : (
                                <p className="wa-message-text">{m.content}</p>
                              )}
                            </div>

                            <div className="wa-msg-meta">
                              <small title={new Date(m.createdAt).toLocaleString(isMr ? 'mr-IN' : 'en-IN')}>
                                {formatBubbleTimestamp(m.createdAt, isMr)}
                              </small>
                              {mine && (
                                <span className="wa-ticks" title="Sent & Delivered" aria-label="Sent & Delivered">
                                  ✓✓
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={bottom} />
              </div>

              {/* WhatsApp Composer Bar */}
              {canSend && (
                <div className="group-composer wa-composer">
                  {/* Pending Attachment Preview */}
                  {pendingAttachment && (
                    <div className="wa-pending-attachment">
                      <div className="wa-pending-info">
                        <span className="wa-pending-icon">
                          {pendingAttachment.type === 'PDF' ? '📄' : pendingAttachment.type === 'VIDEO' ? '🎬' : '📷'}
                        </span>
                        <span className="wa-pending-name">{pendingAttachment.name}</span>
                      </div>
                      <button 
                        type="button" 
                        className="wa-pending-remove" 
                        onClick={() => {
                          setPendingAttachment(null);
                          if (fileRef.current) fileRef.current.value = '';
                        }} 
                        aria-label="Remove attachment"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Main Composition Row */}
                  <div className="wa-compose-row">
                    {/* Camera Button to open live camera directly */}
                    <button
                      type="button"
                      className="wa-camera-btn"
                      onClick={() => setCameraModalOpen(true)}
                      title={isMr ? 'कॅमेऱ्याने फोटो काढा' : 'Take photo with camera'}
                      aria-label={isMr ? 'कॅमेरा उघडा' : 'Open camera'}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                    </button>

                    {/* Attachment Button for gallery photos, videos, and PDFs */}
                    <label className="chat-image-picker wa-attach" title={isMr ? 'फोटो, व्हिडिओ किंवा PDF जोडा' : 'Attach photo, video or PDF'}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                      <input 
                        ref={fileRef} 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.webm,.mov" 
                        onChange={e => chooseAttachment(e.target.files?.[0])}
                      />
                    </label>

                    <div className="wa-input-pill">
                      <textarea 
                        ref={textareaRef}
                        rows="1" 
                        value={compose} 
                        onChange={e => setCompose(e.target.value)} 
                        placeholder={isMr ? 'संदेश लिहा…' : 'Type a message…'} 
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                      />
                    </div>

                    <button 
                      type="button"
                      className="primary-btn wa-send-btn" 
                      disabled={busy || (!compose.trim() && !pendingAttachment)} 
                      onClick={send}
                      aria-label={isMr ? 'पाठवा' : 'Send'}
                    >
                      {busy ? '…' : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {create && (
        <Modal title={isMr ? 'नवीन गट तयार करा' : 'Create group'} onClose={() => setCreate(false)}>
          <form className="form-grid" onSubmit={createGroup}>
            <label className="span-2">
              {isMr ? 'गटाचे नाव' : 'Group name'}
              <input 
                required 
                maxLength="160" 
                value={form.name} 
                onChange={e => setForm({ ...form, name: e.target.value })} 
                placeholder={isMr ? 'उदा. प्रभाग विकास टीम' : 'e.g. Ward Development Team'} 
              />
            </label>
            {(master || sub) && (
              <div className="span-2">
                <SearchableSelect 
                  label={isMr ? 'प्रभाग' : 'Ward'} 
                  value={form.wardId} 
                  onChange={v => setForm({ ...form, wardId: v })} 
                  options={wardOptions} 
                  placeholder={isMr ? 'प्रभाग निवडा' : 'Select ward'} 
                />
              </div>
            )}
            <label className="span-2">
              {isMr ? 'गट प्रकार' : 'Group type'}
              <select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>
                <option value="CHAT">{isMr ? 'गट चॅट — सर्व सदस्य संदेश पाठवू शकतात' : 'Group chat — everyone can send'}</option>
                <option value="BROADCAST">{isMr ? 'प्रसारण — फक्त गट मालक/प्रशासक संदेश पाठवू शकतात' : 'Broadcast — only group owner/admin can send'}</option>
              </select>
            </label>
            <div className="info-note span-2">
              {isMr 
                ? 'प्रभागातील सदस्य आपोआप जोडले जातात. सर्व चॅट या गटांपासून वेगळे राहतात. प्रत्येक नगरसेवकाचा स्वतंत्र गट आधीच उपलब्ध आहे.' 
                : 'Ward members are added automatically. All chat stays separate from these groups. Each Nagarsevak already has a personal group.'}
            </div>
            <div className="modal-actions span-2">
              <button type="button" className="ghost-btn" onClick={() => setCreate(false)}>
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button className="primary-btn" disabled={busy}>
                {busy ? (isMr ? 'तयार करत आहे…' : 'Creating…') : (isMr ? 'गट तयार करा' : 'Create group')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {clearModalOpen && (
        <Modal
          title={isMr ? 'चॅट साफ करायचा आहे का?' : 'Clear this chat?'}
          onClose={() => !clearing && setClearModalOpen(false)}
          layer={100}
        >
          <div className="wa-clear-dialog-content">
            <div className="wa-clear-warning-box">
              <span className="wa-clear-warning-icon">🗑️</span>
              <div>
                <strong>
                  {isMr ? 'फक्त तुमच्या खात्यावरील संदेश साफ केले जातील' : 'Messages will be cleared for you only'}
                </strong>
                <p>
                  {isMr 
                    ? `“${groupTitle(active)}” मधील सर्व संदेश तुमच्या खात्यावरून काढून टाकले जातील. इतर सदस्यांचे संदेश सुरक्षित राहतील.`
                    : `All existing messages in “${groupTitle(active)}” will be cleared from your account. Other members will keep their messages.`}
                </p>
              </div>
            </div>

            <div className="wa-clear-policy-note">
              <span>🛡️ <strong>{isMr ? 'सुरक्षितता धोरण:' : 'Retention Policy:'}</strong> {isMr 
                ? '७५ दिवसांनंतर सर्व जुने संदेश आपोआप कायमचे नष्ट होतात (रिसायकल बिनमध्ये जात नाहीत).' 
                : 'Messages automatically permanently delete after 75 days (do not enter the Recycle Bin).'}</span>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="ghost-btn" 
                onClick={() => setClearModalOpen(false)}
                disabled={clearing}
              >
                {isMr ? 'रद्द करा' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="primary-btn danger" 
                onClick={executeClearChat}
                disabled={clearing}
              >
                {clearing ? (isMr ? 'साफ करत आहे…' : 'Clearing…') : (isMr ? 'चॅट साफ करा' : 'Clear Chat')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isChatVisible && cameraModalOpen && (
        <LiveCameraModal
          isOpen={cameraModalOpen}
          onClose={() => setCameraModalOpen(false)}
          onCapture={file => chooseAttachment(file)}
          isMr={isMr}
        />
      )}

      {selectedResidentId && (
        <ResidentProfileModal
          userId={selectedResidentId}
          fallbackName={selectedResidentName}
          isMr={isMr}
          onClose={() => setSelectedResidentId(null)}
        />
      )}

      {lightboxImage && (
        <div className="wa-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="wa-lightbox-modal" onClick={e => e.stopPropagation()}>
            <div className="wa-lightbox-bar">
              <button 
                type="button" 
                className="wa-lightbox-close-btn" 
                onClick={() => setLightboxImage(null)}
                aria-label="Close"
                title={isMr ? 'बंद करा (Esc)' : 'Close (Esc)'}
              >
                ✕
              </button>
              <div className="wa-lightbox-title-wrap">
                <span className="wa-lightbox-title">{lightboxImage.name || (isMr ? 'फोटो' : 'Photo')}</span>
                {lightboxImage.date && (
                  <span className="wa-lightbox-date">{formatBubbleTimestamp(lightboxImage.date, isMr)}</span>
                )}
              </div>
              <a 
                href={lightboxImage.url} 
                download={lightboxImage.name || 'Photo.jpg'} 
                className="wa-lightbox-dl-btn"
                title={isMr ? 'डाउनलोड करा' : 'Download'}
                onClick={e => e.stopPropagation()}
              >
                ⬇️
              </a>
            </div>
            <div className="wa-lightbox-body">
              <img src={lightboxImage.url} alt="Shared Photo Preview" className="wa-lightbox-img" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatAttachment({ groupId, messageId, type, fileName, messageDate, isMr, onOpenImage }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let url = '';
    api.chatAttachmentBlob(groupId, messageId)
      .then(u => {
        url = u;
        if (live) setSrc(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [groupId, messageId]);

  if (failed) {
    return (
      <div className="chat-image-error">
        {type === 'PDF' 
          ? (isMr ? 'दस्तऐवज अनुपलब्ध आहे' : 'Document unavailable') 
          : type === 'VIDEO' 
            ? (isMr ? 'व्हिडिओ अनुपलब्ध आहे' : 'Video unavailable') 
            : (isMr ? 'चित्र अनुपलब्ध आहे' : 'Image unavailable')}
      </div>
    );
  }

  if (!src) {
    return (
      <div className="chat-image-loading">
        {isMr ? 'लोड होत आहे…' : `Loading ${type === 'PDF' ? 'document' : type === 'VIDEO' ? 'video' : 'image'}…`}
      </div>
    );
  }

  if (type === 'PDF') {
    const docName = fileName || `Document_${String(messageId || '').slice(0, 8)}.pdf`;
    const ext = (docName.split('.').pop() || 'PDF').toUpperCase();
    const isDocx = ['DOC', 'DOCX'].includes(ext);
    const isXls = ['XLS', 'XLSX', 'CSV'].includes(ext);
    const isPpt = ['PPT', 'PPTX'].includes(ext);
    const isText = ['TXT'].includes(ext);
    const badgeColor = isDocx ? '#2b579a' : isXls ? '#217346' : isPpt ? '#d24726' : isText ? '#475569' : '#e53935';
    const dateFormatted = messageDate ? formatChatDate(messageDate, isMr) : '';

    const triggerDownload = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (!src) return;
      try {
        const a = document.createElement('a');
        a.href = src;
        a.download = docName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { document.body.removeChild(a); } catch (_) {}
        }, 300);
      } catch (err) {
        console.error('Download error:', err);
      }
    };

    const triggerOpen = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (!src) return;
      const win = window.open(src, '_blank');
      if (!win) {
        triggerDownload(e);
      }
    };

    return (
      <div className="wa-pdf-card" onClick={triggerDownload} title={isMr ? `“${docName}” डाउनलोड करण्यासाठी क्लिक करा` : `Click to download “${docName}”`}>
        <div className="wa-pdf-badge-icon" style={{ backgroundColor: badgeColor }}>
          <span className="wa-pdf-badge-text">{ext.slice(0, 4)}</span>
        </div>
        <div className="wa-pdf-info">
          <span className="wa-pdf-name" title={docName}>{docName}</span>
          <div className="wa-pdf-sub">
            <span className="wa-pdf-ext">{ext}</span>
            {dateFormatted && <span className="wa-pdf-date">• {dateFormatted}</span>}
          </div>
          <div className="wa-pdf-actions">
            <button type="button" className="wa-pdf-btn wa-pdf-btn-dl" onClick={triggerDownload} title={isMr ? 'डाउनलोड करा' : 'Download'}>
              ⬇️ {isMr ? 'डाउनलोड' : 'Download'}
            </button>
            <button type="button" className="wa-pdf-btn wa-pdf-btn-open" onClick={triggerOpen} title={isMr ? 'पहा' : 'View'}>
              👁️ {isMr ? 'पहा' : 'View'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'VIDEO') {
    return (
      <div className="wa-video-card">
        <video 
          className="wa-chat-video" 
          src={src} 
          controls 
          playsInline 
          webkit-playsinline="true"
          preload="metadata" 
        />
      </div>
    );
  }

  return (
    <div className="wa-image-card">
      <img 
        className="wa-chat-image" 
        src={src} 
        alt={fileName || 'Shared Photo'} 
        onClick={() => onOpenImage?.(src, fileName || 'Photo.jpg', messageDate)} 
        title={isMr ? 'मोठ्या आकारात पाहण्यासाठी क्लिक करा' : 'Click to view full image'}
      />
    </div>
  );
}

function readFileData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * s));
        c.height = Math.max(1, Math.round(img.height * s));
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('Image processing is unavailable.'));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL('image/jpeg', 0.72);
        if (data.length > 1450000) data = c.toDataURL('image/jpeg', 0.58);
        resolve(data);
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function LiveCameraModal({ isOpen, onClose, onCapture, isMr }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeInputRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [loading, setLoading] = useState(true);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch (e) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async (mode = facingMode) => {
    stopStream();
    setLoading(true);
    setCameraError('');
    setHasCamera(false);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError(isMr ? 'तुमच्या ब्राउझरमध्ये थेट कॅमेरा उपलब्ध नाही.' : 'Live camera is not supported in this browser.');
      setLoading(false);
      return;
    }

    try {
      const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 800 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
      const constraints = isMobile
        ? { video: { facingMode: mode ? { ideal: mode } : 'environment' }, audio: false }
        : { video: { facingMode: mode ? { ideal: mode } : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn('Primary camera constraints failed, attempting fallback:', firstErr);
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setHasCamera(true);
      setLoading(false);
    } catch (err) {
      console.error('Camera access error:', err);
      setHasCamera(false);
      setLoading(false);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      if (isDenied) {
        setCameraError('PERMISSION_DENIED');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError(isMr ? 'कोणताही कॅमेरा आढळला नाही.' : 'No camera found on this device.');
      } else {
        setCameraError(err.message || (isMr ? 'कॅमेरा सुरू करणे शक्य झाले नाही.' : 'Unable to access camera.'));
      }
    }
  };

  // Start video stream on open or facing mode toggle
  useEffect(() => {
    if (!isOpen) return;
    setCapturedDataUrl(null);
    setCapturedBlob(null);
    startCamera(facingMode);

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  const snapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedDataUrl(dataUrl);

    canvas.toBlob(blob => {
      if (blob) {
        let file;
        try {
          file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        } catch (e) {
          file = blob;
          file.name = `camera_${Date.now()}.jpg`;
        }
        setCapturedBlob(file);
      }
    }, 'image/jpeg', 0.85);
  };

  const retakePhoto = () => {
    setCapturedDataUrl(null);
    setCapturedBlob(null);
  };

  const confirmSend = () => {
    if (capturedBlob) {
      onCapture(capturedBlob);
      onClose();
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div className="wa-camera-modal-overlay" role="dialog" aria-modal="true">
      <div className="wa-camera-modal-content">
        {/* Top Header Bar */}
        <div className="wa-camera-top-bar">
          <button 
            type="button" 
            className="wa-cam-icon-btn" 
            onClick={onClose}
            aria-label={isMr ? 'कॅमेरा बंद करा' : 'Close camera'}
            title={isMr ? 'बंद करा' : 'Close'}
          >
            ✕
          </button>
          <span className="wa-cam-bar-title">
            {capturedDataUrl ? (isMr ? 'फोटो पूर्वदृश्य' : 'Photo Preview') : (isMr ? 'कॅमेरा' : 'Camera')}
          </span>
          {!capturedDataUrl && hasCamera ? (
            <button 
              type="button" 
              className="wa-cam-icon-btn" 
              onClick={toggleCamera}
              title={isMr ? 'कॅमेरा बदला (पुढील/मागील)' : 'Flip camera'}
              aria-label={isMr ? 'कॅमेरा बदला' : 'Flip camera'}
            >
              🔄
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        {/* Viewfinder Viewport */}
        <div className="wa-camera-viewport">
          {capturedDataUrl ? (
            <img src={capturedDataUrl} alt="Captured" className="wa-camera-preview-img" />
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`wa-camera-video ${facingMode === 'user' ? 'mirrored' : ''}`} 
              />
              {loading && (
                <div className="wa-camera-loading">
                  <div className="wa-spinner" />
                  <p>{isMr ? 'कॅमेरा सुरू होत आहे…' : 'Starting camera…'}</p>
                </div>
              )}
              {cameraError && (
                <div className="wa-camera-error-box">
                  {cameraError === 'PERMISSION_DENIED' ? (
                    <div className="wa-cam-perm-wrap">
                      <div className="wa-cam-perm-icon">📷</div>
                      <h4 className="wa-cam-perm-title">
                        {isMr ? 'कॅमेरा परवानगी आवश्यक आहे' : 'Camera Permission Required'}
                      </h4>
                      <p className="wa-cam-perm-desc">
                        {isMr 
                          ? 'फोटो काढण्यासाठी खालील बटणावर टॅप करा.' 
                          : 'Tap below to capture photo using your phone camera.'}
                      </p>
                      <button
                        type="button"
                        className="wa-cam-action-btn wa-cam-allow-btn"
                        style={{ background: '#0284c7', borderColor: '#0284c7' }}
                        onClick={() => nativeInputRef.current?.click()}
                      >
                        📸 {isMr ? 'फोनच्या कॅमेरा ॲपने फोटो काढा' : 'Take photo using phone camera'}
                      </button>
                    </div>
                  ) : (
                    <div className="wa-cam-perm-wrap">
                      <p style={{ margin: '0 0 12px', color: '#fca5a5', fontWeight: 600 }}>⚠️ {cameraError}</p>
                      <button
                        type="button"
                        className="wa-cam-action-btn wa-cam-allow-btn"
                        style={{ background: '#0284c7', borderColor: '#0284c7' }}
                        onClick={() => nativeInputRef.current?.click()}
                      >
                        📸 {isMr ? 'फोनच्या कॅमेरा ॲपने फोटो काढा' : 'Take photo using phone camera'}
                      </button>
                    </div>
                  )}
                  <input 
                    ref={nativeInputRef}
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    className="camera-hidden-input"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onCapture(file);
                        onClose();
                      }
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom Shutter / Action Bar */}
        <div className="wa-camera-bottom-bar">
          {capturedDataUrl ? (
            <div className="wa-camera-preview-actions">
              <button type="button" className="wa-cam-retake-btn" onClick={retakePhoto}>
                ↻ {isMr ? 'पुन्हा काढा' : 'Retake'}
              </button>
              <button type="button" className="wa-cam-send-btn" onClick={confirmSend}>
                ✓ {isMr ? 'फोटो पाठवा' : 'Send Photo'}
              </button>
            </div>
          ) : hasCamera && !cameraError ? (
            <div className="wa-camera-shutter-container">
              <button 
                type="button" 
                className="wa-camera-shutter" 
                onClick={snapPhoto}
                disabled={loading}
                aria-label={isMr ? 'फोटो काढा' : 'Take Photo'}
                title={isMr ? 'फोटो काढा' : 'Take Photo'}
              >
                <div className="wa-camera-shutter-inner" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResidentProfileModal({ userId, fallbackName, isMr, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setLoading(true);
    setErr('');
    api.chatResidentDetails(userId)
      .then(res => {
        if (live) {
          setProfile(res.data);
          setLoading(false);
        }
      })
      .catch(e => {
        if (live) {
          setErr(e.message || 'Unable to load resident details.');
          setLoading(false);
        }
      });
    return () => { live = false; };
  }, [userId]);

  const p = profile?.person;
  const displayName = profile?.name || fallbackName || (isMr ? 'नागरिक' : 'Resident');
  const mobile = profile?.mobile || p?.mobile;
  const email = profile?.email || p?.email;
  const cleanMobile = String(mobile || '').replace(/\D/g, '');

  const isEmpProfile = ['EMPLOYEE', 'FIELD_EMPLOYEE'].includes(String(profile?.role || '').toUpperCase()) || Boolean(profile?.employeeProfile);

  return (
    <Modal isOpen onClose={onClose} title={isEmpProfile ? (isMr ? 'कर्मचारी संपूर्ण तपशील' : 'Employee Profile') : (isMr ? 'नागरिक संपूर्ण तपशील' : 'Resident Profile')}>
      <div className="wa-resident-modal-wrap">
        {loading ? (
          <Loading />
        ) : err ? (
          <div className="error-box">{err}</div>
        ) : (
          <div className="wa-resident-modal-content">
            {/* Top Identity Banner */}
            <div className="wa-resident-head-card">
              <FaceAvatar name={displayName} className="wa-resident-avatar" />
              <div className="wa-resident-head-info">
                <div className="wa-resident-name-row">
                  <h3 className="notranslate" translate="no">{displayName}</h3>
                  <span className={`wa-role-badge ${isEmpProfile ? 'emp' : 'citizen'}`}>
                    {isEmpProfile ? (isMr ? '🛠️ कर्मचारी' : '🛠️ Employee') : (isMr ? '👤 नागरिक' : '👤 Citizen')}
                  </span>
                </div>
                {profile?.ward && (
                  <p className="wa-resident-ward-sub">
                    📍 {formatWardNumber(profile.ward.wardNumber, isMr ? 'mr' : 'en')}
                    {profile.ward.name ? ` · ${profile.ward.name}` : ''}
                  </p>
                )}
                {profile?.registeredAt && (
                  <small className="wa-resident-reg-time">
                    {isMr ? 'नोंदणी तारीख: ' : 'Registered: '}
                    {new Date(profile.registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </small>
                )}
              </div>
            </div>

            {/* Quick Contact Actions */}
            {cleanMobile && (
              <div className="wa-resident-quick-actions">
                <a 
                  href={`tel:${cleanMobile}`} 
                  className="wa-resident-action-btn call"
                  title={isMr ? 'कॉल करा' : 'Call'}
                >
                  <span className="icon">📞</span>
                  <span>{isMr ? 'कॉल करा' : 'Call'}</span>
                </a>
                <a 
                  href={`https://wa.me/91${cleanMobile}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="wa-resident-action-btn whatsapp"
                  title={isMr ? 'व्हॉट्सअ‍ॅपवर संदेश पाठवा' : 'WhatsApp'}
                >
                  <span className="icon">💬</span>
                  <span>WhatsApp</span>
                </a>
              </div>
            )}

            {/* Detailed Info Grid */}
            <div className="wa-resident-sections">
              {/* Contact Information */}
              <div className="wa-resident-section-card">
                <h4>📞 {isMr ? 'संपर्क माहिती' : 'Contact Information'}</h4>
                <div className="wa-resident-details-grid">
                  <div className="wa-res-field">
                    <label>{isMr ? 'मोबाईल नंबर' : 'Mobile Number'}</label>
                    <strong className="notranslate" translate="no">{mobile || '—'}</strong>
                  </div>
                  {p?.alternateMobile && (
                    <div className="wa-res-field">
                      <label>{isMr ? 'पर्यायी मोबाईल' : 'Alternate Mobile'}</label>
                      <strong className="notranslate" translate="no">{p.alternateMobile}</strong>
                    </div>
                  )}
                  <div className="wa-res-field">
                    <label>{isMr ? 'ईमेल' : 'Email Address'}</label>
                    <span className="notranslate" translate="no">{email || '—'}</span>
                  </div>
                  <div className="wa-res-field">
                    <label>{isMr ? 'खाते स्थिती' : 'Account Status'}</label>
                    <span className={`wa-status-pill ${String(profile?.status).toLowerCase()}`}>
                      {profile?.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Employee Details Card (for staff/officials) */}
              {profile?.employeeProfile && (
                <div className="wa-resident-section-card">
                  <h4>🛠️ {isMr ? 'कर्मचारी तपशील' : 'Employee Details'}</h4>
                  <div className="wa-resident-details-grid">
                    <div className="wa-res-field">
                      <label>{isMr ? 'पदनाम / हुद्दा' : 'Designation'}</label>
                      <strong className="notranslate" translate="no">{profile.employeeProfile.designation || 'Field Officer'}</strong>
                    </div>
                    {profile.employeeProfile.department && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'विभाग' : 'Department'}</label>
                        <span className="notranslate" translate="no">{profile.employeeProfile.department}</span>
                      </div>
                    )}
                    {profile.employeeProfile.employeeCode && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'कर्मचारी कोड' : 'Employee Code'}</label>
                        <span className="notranslate" translate="no">{profile.employeeProfile.employeeCode}</span>
                      </div>
                    )}
                    {profile.employeeProfile.areas?.length > 0 && (
                      <div className="wa-res-field full-width">
                        <label>{isMr ? 'नेमून दिलेले प्रभाग / कॉलनी' : 'Assigned Areas / Colonies'}</label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {profile.employeeProfile.areas.map((a, i) => (
                            <span key={i} className="dash-colony-tag notranslate" translate="no">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Residence & House Address */}
              <div className="wa-resident-section-card">
                <h4>🏠 {isMr ? 'निवास व पत्ता' : 'Residence & Address'}</h4>
                <div className="wa-resident-details-grid">
                  <div className="wa-res-field">
                    <label>{isMr ? 'घर क्र. / इमारत' : 'House / Flat No.'}</label>
                    <strong>{p?.house?.houseNumber || '—'}</strong>
                  </div>
                  <div className="wa-res-field">
                    <label>{isMr ? 'परिसर / क्षेत्र' : 'Area / Landmark'}</label>
                    <span>{p?.house?.area || '—'}</span>
                  </div>
                  {p?.house?.address && (
                    <div className="wa-res-field full-width">
                      <label>{isMr ? 'संपूर्ण पत्ता' : 'Full Address'}</label>
                      <p>{p.house.address}{p.house.pinCode ? ` - ${p.house.pinCode}` : ''}</p>
                    </div>
                  )}
                  <div className="wa-res-field">
                    <label>{isMr ? 'रहिवासी प्रकार' : 'Residence Status'}</label>
                    <span>
                      {p?.residenceStatus === 'OWN' 
                        ? (isMr ? 'स्वतःचे घर (Own)' : 'Own House') 
                        : p?.residenceStatus === 'RENT' 
                          ? (isMr ? 'भाडेकरू (Rent)' : 'Tenant (Rent)') 
                          : (p?.residenceStatus || '—')}
                    </span>
                  </div>
                  <div className="wa-res-field">
                    <label>{isMr ? 'उपस्थिती स्थिती' : 'Presence Status'}</label>
                    <span>
                      {p?.presenceStatus === 'AT_HOME' 
                        ? (isMr ? 'घरी उपस्थित' : 'At Home / Local') 
                        : p?.presenceStatus === 'OUT_OF_CITY' 
                          ? (isMr ? `शहराबाहेर (${p?.currentCity || ''})` : `Out of City (${p?.currentCity || ''})`) 
                          : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Voter Information */}
              <div className="wa-resident-section-card">
                <h4>🗳️ {isMr ? 'मतदार माहिती' : 'Voter Details'}</h4>
                <div className="wa-resident-details-grid">
                  <div className="wa-res-field">
                    <label>{isMr ? 'मतदार स्थिती' : 'Voter Status'}</label>
                    <span className="wa-voter-chip">
                      {p?.voterProfile?.status === 'VOTER' 
                        ? (isMr ? '✅ नोंदणीकृत मतदार' : '✅ Registered Voter') 
                        : (p?.voterProfile?.status || (isMr ? 'अनोंदणीकृत / माहिती नाही' : 'Not Specified'))}
                    </span>
                  </div>
                  <div className="wa-res-field">
                    <label>{isMr ? 'मतदार ओळखपत्र क्र. (EPIC)' : 'Voter ID (EPIC No.)'}</label>
                    <strong className="notranslate" translate="no">
                      {p?.voterProfile?.epicNumber || (isMr ? 'उपलब्ध नाही' : 'Not Available')}
                    </strong>
                  </div>
                  {p?.voterProfile?.constituency && (
                    <div className="wa-res-field">
                      <label>{isMr ? 'मतदारसंघ' : 'Constituency'}</label>
                      <span>{p.voterProfile.constituency}</span>
                    </div>
                  )}
                  {p?.voterProfile?.voterCenter && (
                    <div className="wa-res-field">
                      <label>{isMr ? 'मतदान केंद्र' : 'Polling Center / Booth'}</label>
                      <span>{p.voterProfile.voterCenter}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Family & Personal Details */}
              {(p?.family || p?.gender || p?.occupation || p?.dob) && (
                <div className="wa-resident-section-card">
                  <h4>👨‍👩‍👧‍👦 {isMr ? 'कौटुंबिक व वैयक्तिक माहिती' : 'Family & Personal Details'}</h4>
                  <div className="wa-resident-details-grid">
                    {p?.family && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'कुटुंबाचे नाव' : 'Family Name'}</label>
                        <strong>{p.family.familyName || '—'}</strong>
                      </div>
                    )}
                    {p?.relationshipToHead && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'कुटुंबप्रमुखाशी नाते' : 'Relationship to Head'}</label>
                        <span>{p.relationshipToHead}</span>
                      </div>
                    )}
                    {p?.gender && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'लिंग' : 'Gender'}</label>
                        <span>
                          {p.gender === 'MALE' ? (isMr ? 'पुरुष' : 'Male') : p.gender === 'FEMALE' ? (isMr ? 'स्त्री' : 'Female') : p.gender}
                        </span>
                      </div>
                    )}
                    {(p?.dob || p?.age) && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'वय' : 'Age'}</label>
                        <span>{p?.age ? `${p.age} ${isMr ? 'वर्षे' : 'years'}` : (p?.dob ? p.dob : '—')}</span>
                      </div>
                    )}
                    {p?.occupation && (
                      <div className="wa-res-field">
                        <label>{isMr ? 'व्यवसाय' : 'Occupation'}</label>
                        <span>{p.occupation} {p?.companyName ? `(${p.companyName})` : ''}</span>
                      </div>
                    )}
                    {(p?.family?.nativeVillage || p?.family?.nativeTaluka) && (
                      <div className="wa-res-field full-width">
                        <label>{isMr ? 'मूळ गाव / तालुका' : 'Native Place'}</label>
                        <span>
                          {[p.family.nativeVillage, p.family.nativeTaluka, p.family.nativeDistrict].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="primary-btn" onClick={onClose}>
                {isMr ? 'बंद करा' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default GroupPage;
