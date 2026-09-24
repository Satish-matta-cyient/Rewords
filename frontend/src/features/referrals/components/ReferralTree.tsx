import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReferralNode } from '@shared/types';
import { Avatar, StatusChip, Chip } from '@/components/ui';
import { formatNumber, formatDate } from '@/utils/format';

function ReferralTreeNode({ node, depth, levelFilter }: { node: ReferralNode; depth: number; levelFilter: number | null }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const dimmed = levelFilter !== null && node.depth !== levelFilter && node.depth !== 0;

  return (
    <li style={{ position: 'relative', paddingLeft: depth > 0 ? 24 : 0, opacity: dimmed ? 0.4 : 1 }}>
      {depth > 0 ? (
        <>
          <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 1, background: 'var(--border)' }} aria-hidden />
          <span style={{ position: 'absolute', left: 8, top: 26, width: 12, height: 1, background: 'var(--border)' }} aria-hidden />
        </>
      ) : null}

      <div
        className="row"
        style={{
          gap: 10, padding: '10px 12px', marginBottom: 6,
          background: depth === 0 ? 'var(--accent-soft)' : 'var(--card)',
          border: `1px solid ${depth === 0 ? 'var(--primary)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.fullName}'s referrals`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform var(--duration) var(--ease)' }}>
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        ) : <span style={{ width: 18 }} aria-hidden />}

        <Avatar name={node.fullName} src={node.avatarUrl} size={32} />

        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <span className="truncate" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              {depth === 0 ? 'You' : node.fullName}
            </span>
            {node.depth > 0 ? <Chip tone="neutral">L{node.depth}</Chip> : null}
            {node.status !== 'ACTIVE' ? <StatusChip status={node.status} /> : null}
          </div>
          <div className="small muted truncate">
            Joined {formatDate(node.joinedAt)} · {node.directReferrals} direct referral{node.directReferrals === 1 ? '' : 's'}
          </div>
        </div>

        {node.depth > 0 ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--primary)' }}>
              {formatNumber(node.pointsGenerated)}
            </div>
            <div className="small muted">pts to you</div>
          </div>
        ) : null}
      </div>

      {hasChildren && expanded ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {node.children.map((child) => (
            <ReferralTreeNode key={child.userId} node={child} depth={depth + 1} levelFilter={levelFilter} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ReferralTree({ root, levelFilter }: { root: ReferralNode; levelFilter: number | null }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Referral network">
      <ReferralTreeNode node={root} depth={0} levelFilter={levelFilter} />
    </ul>
  );
}
