import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import {
  Empty,
  ErrorBox,
  Field,
  Loading,
  Modal,
  PageHeader,
  PaginationBar,
  SearchableSelect
} from '../components/Ui';
import WardFilter from '../components/WardFilter';
import { useWardFilter } from '../wardFilter';
import { formatWardLabel, formatWardNumber } from '../wardFormat';
import { can } from '../rbac';
import { directionsUrl, hasCoords, PEOPLE_PLACE_OPTIONS, presenceApiQuery } from '../location';
import { MapPreview } from '../components/LocationMap';
import {
  SearchIcon,
  UsersIcon,
  UserCheckIcon,
  ClockIcon,
  EyeIcon,
  EditIcon,
  RefreshCwIcon,
  PhoneIcon,
  CheckIcon,
  AlertCircleIcon,
  MapPinIcon,
  BuildingIcon,
  ShieldIcon
} from '../components/Icons';
import { getLanguage } from '../language';

function getInitials(name) {
  if (!name) return 'C';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Voters() {
  const { selectedWardId, wards } = useWardFilter();
  const isMr = getLanguage() === 'mr';

  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 25 });
  const [filter, setFilter] = useState('');
  const [presence, setPresence] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [kpiStats, setKpiStats] = useState({ total: 0, voters: 0, nonVoters: 0, unspecified: 0 });
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadKpiStats() {
    try {
      const res = await api.personKpis({
        wardId: selectedWardId || undefined
      });
      const d = res?.data || {};
      setKpiStats({
        total: d.total || 0,
        voters: d.voters || 0,
        nonVoters: d.nonVoters || 0,
        unspecified: d.unspecified || 0
      });
    } catch (_) {}
  }

  async function load(nextPage = page, nextLimit = limit) {
    try {
      setError('');
      const extra = presenceApiQuery(presence);
      const status = extra.status || filter || undefined;
      const r = await api.voters({
        page: nextPage,
        limit: nextLimit,
        status,
        wardId: selectedWardId || undefined,
        search: search.trim() || undefined,
        presenceStatus: extra.presenceStatus
      });
      setRows(r.data || []);
      setMeta(r.meta || { total: (r.data || []).length, page: nextPage, limit: nextLimit });
    } catch (e) {
      setError(e.message);
      setRows([]);
      setMeta({ total: 0, page: 1, limit: nextLimit });
    }
  }

  useEffect(() => {
    setPage(1);
  }, [filter, presence, selectedWardId, search]);

  useEffect(() => {
    const t = setTimeout(() => load(page, limit), 220);
    return () => clearTimeout(t);
  }, [page, limit, filter, presence, selectedWardId, search]);

  useEffect(() => {
    loadKpiStats();
  }, [selectedWardId]);

  const visible = useMemo(() => rows || [], [rows]);
  const pages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || limit)));
  const total = meta.total || 0;
  const hasActiveFilters = Boolean(search || filter || presence);



  async function openDetailModal(personId) {
    try {
      setError('');
      const res = await api.person(personId);
      setDetail(res.data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.updateVoter(editing.id, {
        status: editing.status,
        votingWard: editing.votingWard,
        officialVoterIdRef: editing.officialVoterIdRef?.trim() || null,
        constituency: editing.constituency?.trim() || null,
        voterCenter: editing.voterCenter?.trim() || null,
        voterRoom: editing.voterRoom?.trim() || null,
        notes: editing.notes?.trim() || null
      });
      setEditing(null);
      await Promise.all([load(), loadKpiStats()]);
      window.dispatchEvent(
        new CustomEvent('ward:toast', {
          detail: {
            type: 'success',
            message: `Voter record for "${editing.fullName}" updated successfully.`
          }
        })
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-data-page voters-page" style={{ paddingTop: '8px' }}>
      <PageHeader
        kicker={isMr ? 'निवडणूक माहिती आणि नागरिक यादी' : 'Electoral Register & Civic Audit'}
        title={isMr ? 'मतदार / अमतदार पडताळणी' : 'Voter / Non-Voter'}
        subtitle={
          isMr
            ? 'नागरिकांची मतदार पात्रता, मतदार ओळखपत्र (EPIC), मतदान केंद्र, कक्ष क्रमांक आणि वॉर्ड मतदार स्थिती तपासा.'
            : 'Audit voter eligibility, official voter ID (EPIC), polling stations, booths, and cross-ward voting status.'
        }
        action={
          <button
            type="button"
            className="exec-page-refresh-btn"
            onClick={() => {
              load();
              loadKpiStats();
            }}
            title="Refresh voter data"
          >
            <RefreshCwIcon size={14} />
            <span>{isMr ? 'ताजे करा' : 'Refresh'}</span>
          </button>
        }
      />

      <ErrorBox error={error} />

      {/* 4 Interactive KPI Cards */}
      <div className="team-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div
          className={`team-kpi-card ${!filter ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilter('')}
          title="Click to view all citizens"
        >
          <div className="team-kpi-icon blue">
            <UsersIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{total}</div>
            <div className="team-kpi-label">{isMr ? 'एकूण नागरिक' : 'Total Citizens'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filter === 'VOTER' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilter(prev => (prev === 'VOTER' ? '' : 'VOTER'))}
          title="Click to filter verified voters"
        >
          <div className="team-kpi-icon green">
            <UserCheckIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.voters}</div>
            <div className="team-kpi-label">{isMr ? 'नोंदणीकृत मतदार' : 'Verified Voters'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filter === 'NON_VOTER' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilter(prev => (prev === 'NON_VOTER' ? '' : 'NON_VOTER'))}
          title="Click to filter non-voters"
        >
          <div className="team-kpi-icon amber">
            <AlertCircleIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.nonVoters}</div>
            <div className="team-kpi-label">{isMr ? 'अमतदार (Non-Voters)' : 'Non-Voters'}</div>
          </div>
        </div>

        <div
          className={`team-kpi-card ${filter === 'NOT_SPECIFIED' ? 'active' : ''}`}
          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
          onClick={() => setFilter(prev => (prev === 'NOT_SPECIFIED' ? '' : 'NOT_SPECIFIED'))}
          title="Click to filter status not specified"
        >
          <div className="team-kpi-icon purple">
            <ClockIcon size={20} />
          </div>
          <div className="team-kpi-info">
            <div className="team-kpi-val">{kpiStats.unspecified}</div>
            <div className="team-kpi-label">{isMr ? 'अनिर्णित / अस्पष्ट' : 'Status Unspecified'}</div>
          </div>
        </div>
      </div>

      {/* Professional Search & Filter Toolbar */}
      <div className="exec-toolbar-panel">
        <div className="exec-toolbar-row">
          <div className="exec-toolbar-left">
            <div className="exec-search-box">
              <SearchIcon size={16} />
              <input
                placeholder={isMr ? 'नाव, मोबाईल, EPIC किंवा केंद्र शोधा…' : 'Search name, mobile, EPIC or booth…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearch('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="exec-quick-ward">
              <WardFilter compact label="" />
            </div>

            <div className="exec-quick-status">
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="exec-filter-select"
              >
                <option value="">{isMr ? 'सर्व मतदार स्थिती (All)' : 'All Voter Statuses'}</option>
                <option value="VOTER">{isMr ? '✓ मतदार (Voters)' : '✓ Verified Voters'}</option>
                <option value="NON_VOTER">{isMr ? '✕ अमतदार (Non-Voters)' : '✕ Non-Voters'}</option>
                <option value="NOT_SPECIFIED">{isMr ? '? अनिर्णित (Not specified)' : '? Not Specified'}</option>
              </select>
            </div>

            <div className="exec-quick-presence">
              <select
                value={presence}
                onChange={e => {
                  setPresence(e.target.value);
                  if (e.target.value === 'OUT_VOTER') setFilter('VOTER');
                }}
                className="exec-filter-select"
              >
                {PEOPLE_PLACE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="exec-toolbar-right">
            {hasActiveFilters && (
              <button
                type="button"
                className="exec-btn-clear"
                onClick={() => {
                  setSearch('');
                  setFilter('');
                  setPresence('');
                  setPage(1);
                }}
              >
                ✕ {isMr ? 'फिल्टर साफ करा' : 'Clear Filters'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      {!rows ? (
        <Loading />
      ) : !visible.length ? (
        <Empty>{isMr ? 'या फिल्टरनुसार कोणतेही नागरिक सापडले नाहीत.' : 'No citizens match this filter.'}</Empty>
      ) : (
        <div className="panel table-wrap voters-table-wrap">
          <table className="voters-table">
            <thead>
              <tr>
                <th>{isMr ? 'नागरिक' : 'Citizen'}</th>
                <th>{isMr ? 'घर आणि कुटुंब' : 'Residence & Family'}</th>
                <th>{isMr ? 'रहिवासी वॉर्ड' : 'Resident Ward'}</th>
                <th>{isMr ? 'मतदार स्थिती' : 'Voter Status'}</th>
                <th>{isMr ? 'मतदार ओळखपत्र (EPIC)' : 'Official Voter ID (EPIC)'}</th>
                <th>{isMr ? 'मतदान वॉर्ड आणि केंद्र' : 'Voting Ward & Center'}</th>
                <th style={{ textAlign: 'center' }}>{isMr ? 'कृती' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const p = r.Person || r.person || {};
                const residentWardNo = formatWardNumber(p.family?.house?.area?.ward?.wardNumber);
                const votingWardNo = formatWardNumber(r.votingWard);
                const isCrossWard = Boolean(r.votingWard && residentWardNo && votingWardNo !== residentWardNo);
                const initials = getInitials(p.fullName || r.fullName);
                const status = r.status || 'NOT_SPECIFIED';

                return (
                  <tr key={r.id || p.id}>
                    <td data-label="Citizen">
                      <div className="exec-cell-user">
                        <div
                          className={`exec-avatar ${status === 'VOTER' ? 'green' : status === 'NON_VOTER' ? 'blue' : 'amber'}`}
                          onClick={() => openDetailModal(p.id || r.personId)}
                          style={{ cursor: 'pointer' }}
                          title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view citizen details'}
                        >
                          {initials}
                        </div>
                        <div className="exec-cell-meta">
                          <button
                            type="button"
                            onClick={() => openDetailModal(p.id || r.personId)}
                            className="exec-cell-name"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              margin: 0,
                              font: 'inherit',
                              fontWeight: 600,
                              color: '#0f172a',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'inline-block'
                            }}
                            title={isMr ? 'तपशील पाहण्यासाठी क्लिक करा' : 'Click to view citizen details'}
                          >
                            {p.fullName || r.fullName || '—'}
                          </button>
                          <span className="exec-cell-sub">
                            {p.age != null && <span>{p.age} yrs</span>}
                            {p.gender && <span>· {p.gender}</span>}
                            {p.mobile ? (
                              <>
                                <span>·</span>
                                <a href={`tel:${p.mobile}`} title="Click to call">
                                  <PhoneIcon size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: '-1px' }} />
                                  {p.mobile}
                                </a>
                              </>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td data-label="Residence & Family">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                          {p.family?.house?.houseNumber ? `House #${p.family.house.houseNumber}` : 'House N/A'}
                        </div>
                        <div className="muted" style={{ fontSize: '11.5px', marginTop: '1px' }}>
                          {p.family?.house?.area?.name || p.family?.familyName || 'Family unlinked'}
                        </div>
                        {hasCoords(p.family?.house?.latitude, p.family?.house?.longitude) ? (
                          <a
                            href={directionsUrl(p.family.house.latitude, p.family.house.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="voter-loc-dir-btn"
                            onClick={e => e.stopPropagation()}
                            title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग / दिशा पहा' : 'Open driving directions to this house in Google Maps'}
                          >
                            <MapPinIcon size={11} />
                            <span>{isMr ? 'दिशा' : 'Directions'}</span>
                          </a>
                        ) : (
                          <span className="voter-loc-dir-empty" title={isMr ? 'घराचे अचूक जीपीएस स्थान उपलब्ध नाही' : 'GPS coordinates not saved'}>
                            <MapPinIcon size={10} style={{ opacity: 0.4 }} />
                            <span>{isMr ? 'पिन नाही' : 'No pin'}</span>
                          </span>
                        )}
                      </div>
                    </td>

                    <td data-label="Resident Ward">
                      {residentWardNo ? (
                        <span className="ward-pill-badge">{residentWardNo}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>

                    <td data-label="Voter Status">
                      {status === 'VOTER' ? (
                        <span className="voter-status-badge voter">
                          <CheckIcon size={12} />
                          <span>{isMr ? 'मतदार' : 'Voter'}</span>
                        </span>
                      ) : status === 'NON_VOTER' ? (
                        <span className="voter-status-badge non-voter">
                          <span>✕</span>
                          <span>{isMr ? 'अमतदार' : 'Non-Voter'}</span>
                        </span>
                      ) : (
                        <span className="voter-status-badge not-specified">
                          <span>?</span>
                          <span>{isMr ? 'अस्पष्ट' : 'Not Specified'}</span>
                        </span>
                      )}
                    </td>

                    <td data-label="Official Voter ID (EPIC)">
                      {r.officialVoterIdRef ? (
                        <span className="epic-id-badge" title="EPIC Number">
                          {r.officialVoterIdRef}
                        </span>
                      ) : (
                        <span className="muted" style={{ fontSize: '12px' }}>— Not linked</span>
                      )}
                    </td>

                    <td data-label="Voting Ward & Center">
                      <div>
                        {votingWardNo ? (
                          <span className={`ward-pill-badge ${isCrossWard ? 'cross-ward' : ''}`}>
                            {votingWardNo}
                            {isCrossWard && <span style={{ fontSize: '10px', opacity: 0.85 }}> (Cross)</span>}
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: '12px' }}>—</span>
                        )}
                        {(r.voterCenter || r.voterRoom) && (
                          <div className="muted" style={{ fontSize: '11px', marginTop: '2px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${r.voterCenter || ''} ${r.voterRoom ? `(Booth: ${r.voterRoom})` : ''}`}>
                            {r.voterCenter || ''} {r.voterRoom ? `· Rm ${r.voterRoom}` : ''}
                          </div>
                        )}
                      </div>
                    </td>

                    <td data-label="Actions" style={{ textAlign: 'center' }}>
                      <div className="exec-action-group" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="exec-btn-view"
                          onClick={() => openDetailModal(p.id || r.personId)}
                          title="View citizen details and family register"
                        >
                          <EyeIcon size={13} />
                          <span>{isMr ? 'तपशील' : 'View'}</span>
                        </button>

                        {can('EDIT_VOTERS') && (
                          <button
                            type="button"
                            className="exec-btn-edit"
                            onClick={() =>
                              setEditing({
                                id: p.id || r.personId,
                                status: ['VOTER', 'NON_VOTER'].includes(r.status) ? r.status : 'NOT_SPECIFIED',
                                votingWard: r.votingWard || '',
                                constituency: r.constituency || '',
                                voterCenter: r.voterCenter || '',
                                voterRoom: r.voterRoom || '',
                                officialVoterIdRef: r.officialVoterIdRef || '',
                                notes: r.notes || '',
                                fullName: p.fullName || r.fullName
                              })
                            }
                            title="Edit voter eligibility, EPIC, or booth"
                          >
                            <EditIcon size={13} />
                            <span>{isMr ? 'संपादित करा' : 'Edit'}</span>
                          </button>
                        )}

                        {hasCoords(p.family?.house?.latitude, p.family?.house?.longitude) ? (
                          <a
                            href={directionsUrl(p.family.house.latitude, p.family.house.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="exec-btn-dir"
                            onClick={e => e.stopPropagation()}
                            title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग / दिशा पहा' : 'Open driving directions in Google Maps'}
                          >
                            <MapPinIcon size={12} />
                            <span>{isMr ? 'दिशा' : 'Directions'}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="exec-btn-dir disabled"
                            disabled
                            title={isMr ? 'या घराचे जीपीएस स्थान नोंदवलेले नाही' : 'No house GPS pin saved'}
                          >
                            <MapPinIcon size={12} style={{ opacity: 0.4 }} />
                            <span>{isMr ? 'दिशा' : 'Directions'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows && (
        <PaginationBar
          page={page}
          pages={pages}
          total={total}
          limit={limit}
          onPage={setPage}
          onLimit={setLimit}
        />
      )}

      {/* Executive View Details Modal */}
      {detail && (
        <Modal
          wide
          title={`${detail.fullName || 'Citizen'} · ${isMr ? 'संपूर्ण नागरिक व मतदार तपशील' : 'Citizen & Voter Profile'}`}
          onClose={() => setDetail(null)}
        >
          <div className="exec-modal-profile-header">
            <div className="exec-modal-avatar">
              {getInitials(detail.fullName)}
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {detail.fullName || '—'}
                </h2>
                {detail.voterProfile?.status === 'VOTER' ? (
                  <span className="voter-status-badge voter">
                    <CheckIcon size={12} />
                    <span>Verified Voter</span>
                  </span>
                ) : detail.voterProfile?.status === 'NON_VOTER' ? (
                  <span className="voter-status-badge non-voter">
                    <span>✕ Non-Voter</span>
                  </span>
                ) : (
                  <span className="voter-status-badge not-specified">
                    <span>? Not Specified</span>
                  </span>
                )}
                {detail.voterProfile?.officialVoterIdRef && (
                  <span className="epic-id-badge">
                    EPIC: {detail.voterProfile.officialVoterIdRef}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                {detail.age != null && <span>Age: <strong>{detail.age} years</strong></span>}
                {detail.gender && <span>Gender: <strong>{detail.gender}</strong></span>}
                {detail.mobile && (
                  <span>
                    Phone: <a href={`tel:${detail.mobile}`} style={{ color: '#0f766e', fontWeight: 600 }}>{detail.mobile}</a>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="exec-detail-grid">
            {/* Card 1: Electoral & Polling Information */}
            <div className="exec-detail-card">
              <h3>
                <ShieldIcon size={14} style={{ color: '#0f766e' }} />
                <span>Electoral & Polling Information</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Voter Status</span>
                <span className="exec-detail-val">
                  {detail.voterProfile?.status === 'VOTER'
                    ? 'Verified Registered Voter'
                    : detail.voterProfile?.status === 'NON_VOTER'
                    ? 'Non-Voter'
                    : 'Not Specified'}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Official Voter ID</span>
                <span className="exec-detail-val">
                  {detail.voterProfile?.officialVoterIdRef ? (
                    <span className="epic-id-badge">{detail.voterProfile.officialVoterIdRef}</span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Voting Ward</span>
                <span className="exec-detail-val">
                  {detail.voterProfile?.votingWard ? (
                    <span className="ward-pill-badge">{formatWardNumber(detail.voterProfile.votingWard)}</span>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Polling Station / School</span>
                <span className="exec-detail-val">{detail.voterProfile?.voterCenter || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Booth / Room No.</span>
                <span className="exec-detail-val">{detail.voterProfile?.voterRoom || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Assembly Constituency</span>
                <span className="exec-detail-val">{detail.voterProfile?.constituency || '—'}</span>
              </div>
              {detail.voterProfile?.notes && (
                <div className="exec-detail-row" style={{ flexDirection: 'column', gap: '4px' }}>
                  <span className="exec-detail-label">Officer Notes:</span>
                  <div style={{ fontSize: '12px', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
                    {detail.voterProfile.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Personal & Contact Information */}
            <div className="exec-detail-card">
              <h3>
                <UsersIcon size={14} style={{ color: '#0f766e' }} />
                <span>Personal & Contact Profile</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Full Name</span>
                <span className="exec-detail-val">{detail.fullName || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Primary Mobile</span>
                <span className="exec-detail-val">
                  {detail.mobile ? (
                    <a href={`tel:${detail.mobile}`} style={{ color: '#0f766e', textDecoration: 'none' }}>
                      {detail.mobile}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Alternate Mobile</span>
                <span className="exec-detail-val">{detail.alternateMobile || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Date of Birth & Age</span>
                <span className="exec-detail-val">
                  {detail.dob || '—'} {detail.age != null ? `(${detail.age} yrs)` : ''}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Gender</span>
                <span className="exec-detail-val">{detail.gender || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Occupation</span>
                <span className="exec-detail-val">{detail.occupation || detail.occupationType || '—'}</span>
              </div>
            </div>

            {/* Card 3: Residence & Household Information */}
            <div className="exec-detail-card">
              <h3>
                <BuildingIcon size={14} style={{ color: '#0f766e' }} />
                <span>Residence & Family House</span>
              </h3>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Family Name</span>
                <span className="exec-detail-val">{detail.family?.familyName || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">House Number</span>
                <span className="exec-detail-val">
                  {detail.family?.house?.houseNumber ? `#${detail.family.house.houseNumber}` : '—'}
                </span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Address</span>
                <span className="exec-detail-val">{detail.family?.house?.address || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Colony / Area</span>
                <span className="exec-detail-val">{detail.family?.house?.area?.name || '—'}</span>
              </div>
              <div className="exec-detail-row">
                <span className="exec-detail-label">Resident Ward</span>
                <span className="exec-detail-val">
                  <span className="ward-pill-badge">
                    {formatWardNumber(detail.family?.house?.area?.ward?.wardNumber) || '—'}
                  </span>
                </span>
              </div>
              {hasCoords(detail.family?.house?.latitude, detail.family?.house?.longitude) && (
                <>
                  <div className="exec-detail-row">
                    <span className="exec-detail-label">{isMr ? 'जीपीएस स्थान' : 'GPS Coordinates'}</span>
                    <span className="exec-detail-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                        {Number(detail.family.house.latitude).toFixed(5)}, {Number(detail.family.house.longitude).toFixed(5)}
                      </span>
                      <a
                        href={directionsUrl(detail.family.house.latitude, detail.family.house.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="voter-loc-dir-btn"
                        style={{ marginTop: 0 }}
                      >
                        <MapPinIcon size={11} />
                        <span>{isMr ? 'दिशा' : 'Directions'}</span>
                      </a>
                    </span>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <MapPreview
                      lat={detail.family.house.latitude}
                      lng={detail.family.house.longitude}
                      label={`House #${detail.family.house.houseNumber || ''}`}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Household Members Table */}
          {detail.family?.members?.length > 0 && (
            <div className="exec-detail-card" style={{ marginBottom: '18px' }}>
              <h3>
                <UsersIcon size={14} style={{ color: '#0f766e' }} />
                <span>Family Members in Same House ({detail.family.members.length})</span>
              </h3>
              <div className="member-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px', marginTop: '4px' }}>
                {detail.family.members.map(m => (
                  <div
                    key={m.id}
                    className="member-card"
                    style={{
                      padding: '10px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{m.fullName}</strong>
                      {m.voterProfile?.status === 'VOTER' && (
                        <span style={{ fontSize: '10px', color: '#059669', fontWeight: 700 }}>✓ Voter</span>
                      )}
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {m.age != null ? `${m.age} yrs` : 'Age N/A'} · {m.gender || ''}
                    </span>
                    {m.mobile && (
                      <span style={{ fontSize: '11px', color: '#0f766e' }}>
                        📞 {m.mobile}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="exec-modal-footer">
            <button type="button" className="exec-modal-btn ghost" onClick={() => setDetail(null)}>
              {isMr ? 'बंद करा' : 'Close'}
            </button>
            {hasCoords(detail.family?.house?.latitude, detail.family?.house?.longitude) && (
              <a
                href={directionsUrl(detail.family.house.latitude, detail.family.house.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                className="exec-modal-btn dir"
                title={isMr ? 'गुगल मॅप्सवर घराचा मार्ग / दिशा पहा' : 'Get driving directions to this house in Google Maps'}
              >
                <MapPinIcon size={14} />
                <span>{isMr ? 'घराचा मार्ग पहा' : 'Get House Directions'}</span>
              </a>
            )}
            {can('EDIT_VOTERS') && (
              <button
                type="button"
                className="exec-modal-btn primary"
                onClick={() => {
                  const d = detail;
                  setDetail(null);
                  setEditing({
                    id: d.id,
                    status: ['VOTER', 'NON_VOTER'].includes(d.voterProfile?.status)
                      ? d.voterProfile.status
                      : 'NOT_SPECIFIED',
                    votingWard: d.voterProfile?.votingWard || '',
                    constituency: d.voterProfile?.constituency || '',
                    voterCenter: d.voterProfile?.voterCenter || '',
                    voterRoom: d.voterProfile?.voterRoom || '',
                    officialVoterIdRef: d.voterProfile?.officialVoterIdRef || '',
                    notes: d.voterProfile?.notes || '',
                    fullName: d.fullName
                  });
                }}
              >
                <EditIcon size={14} />
                <span>{isMr ? 'मतदार माहिती संपादित करा' : 'Edit Voter Information'}</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Voter Modal */}
      {editing && (
        <Modal title={`Edit Voter Details · ${editing.fullName}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={save}>
            <Field label="Voter Status">
              <select
                value={editing.status}
                onChange={e => setEditing({ ...editing, status: e.target.value })}
              >
                <option value="VOTER">Verified Voter</option>
                <option value="NON_VOTER">Non-Voter</option>
                <option value="NOT_SPECIFIED">Not Specified / Unknown</option>
              </select>
            </Field>

            <Field label="Official Voter ID / EPIC Number (Optional)">
              <input
                value={editing.officialVoterIdRef}
                onChange={e => setEditing({ ...editing, officialVoterIdRef: e.target.value.toUpperCase() })}
                placeholder="e.g. ABC1234567"
                style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
              />
            </Field>

            <div className="span-2">
              <SearchableSelect
                label="Voting Ward"
                value={editing.votingWard}
                onChange={v => setEditing({ ...editing, votingWard: v })}
                options={wards.map(w => ({
                  value: w.wardNumber,
                  label: formatWardLabel(w)
                }))}
                placeholder="Search voting ward…"
              />
            </div>

            <Field label="Assembly / Parliamentary Constituency">
              <input
                value={editing.constituency}
                onChange={e => setEditing({ ...editing, constituency: e.target.value })}
                placeholder="e.g. 217 - Ahmednagar City Assembly"
              />
            </Field>

            <Field label="Polling Center / School Name">
              <input
                value={editing.voterCenter}
                onChange={e => setEditing({ ...editing, voterCenter: e.target.value })}
                placeholder="e.g. Z.P. Primary School, Savedi"
              />
            </Field>

            <Field label="Room No. / Booth No.">
              <input
                value={editing.voterRoom}
                onChange={e => setEditing({ ...editing, voterRoom: e.target.value })}
                placeholder="e.g. Room No. 3 / Booth 145"
              />
            </Field>

            <div className="span-2">
              <Field label="Officer Notes / Remarks">
                <textarea
                  rows="3"
                  value={editing.notes}
                  onChange={e => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Additional notes about electoral roll entry, cross-ward relocation, or verification remarks…"
                />
              </Field>
            </div>

            <div className="exec-modal-footer span-2">
              <button type="button" className="exec-modal-btn ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="exec-modal-btn primary" disabled={busy}>
                {busy ? 'Saving changes…' : 'Save Voter Data'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
