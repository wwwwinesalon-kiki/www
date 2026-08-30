'use client';
/* eslint-disable react/react-compiler */
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import type { PaymentStatus } from '@/lib/domain';
import { paymentSummary } from '@/lib/domain';

type Member = {
  id: string;
  name: string;
  line: string | null;
  email: string | null;
  status: string;
  joined: string;
  source: string | null;
  lastContact: string | null;
  created_at: string;
  notes: string | null;
  interestCategories: string | null;
};
type EventRow = {
  id: string;
  title: string;
  slug: string;
  date: string;
  venue: string;
  capacity: number;
  applications: number;
  price: number;
  status: string;
  registration_enabled: number;
  waitlist_enabled: number;
  member_visible: number;
  event_type: string;
  description: string | null;
  start_at: string;
  end_at: string;
  member_only: number;
  public_visible: number;
  cover_image: string | null;
  items_to_bring: string | null;
  precautions: string | null;
};
type Application = {
  id: string;
  name: string;
  email: string;
  member_type: string;
  applied_at: string;
  application_status: string;
  payment_status: string;
  event_title: string;
  event_id: string;
  notes: string | null;
};
type Payment = {
  id: string;
  name: string;
  event: string;
  amount: number;
  status: PaymentStatus;
  paidAt: string | null;
};
type Content = {
  id: string;
  type: string;
  title: string;
  slug: string;
  summary: string;
  publicVisible: number | boolean;
  memberVisible: number | boolean;
  status: string;
  body: string;
  tags: string | null;
  cover_image: string | null;
  audio: string | null;
  published_at: string | null;
};
type Log = {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
};
type Notification = {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
};
type Placement = {
  id: string;
  content_id: string;
  surface: string;
  position: number;
  featured: number;
  pinned: number;
  is_new: number;
  title: string;
  type: string;
};
type AnalyticsRow = {
  event_type: string;
  path: string;
  entity_id: string | null;
  value: number;
  sessions: number;
};
type Data = {
  members: Member[];
  events: EventRow[];
  applications: Application[];
  payments: Payment[];
  contents: Content[];
  logs: Log[];
  notifications: Notification[];
  placements: Placement[];
  analytics: AnalyticsRow[];
  settings: Record<string, unknown>;
  adminUsers: { role: string; access_email: string }[];
};
type Section =
  | ''
  | 'members'
  | 'events'
  | 'applications'
  | 'payments'
  | 'contents'
  | 'pages'
  | 'analytics'
  | 'manual'
  | 'settings'
  | 'logs';
const empty: Data = {
  members: [],
  events: [],
  applications: [],
  payments: [],
  contents: [],
  logs: [],
  notifications: [],
  placements: [],
  analytics: [],
  settings: {},
  adminUsers: [],
};
const nav: [Section, string, typeof LayoutDashboard][] = [
  ['', 'Dashboard', LayoutDashboard],
  ['members', 'Members', Users],
  ['events', 'Events', CalendarDays],
  ['applications', 'Applications', FileText],
  ['payments', 'Payments', CircleDollarSign],
  ['contents', 'Contents', BookOpen],
  ['pages', 'Library / Pages', BookOpen],
  ['analytics', 'Analytics', BarChart3],
  ['manual', '操作説明書', BookOpen],
  ['settings', 'Settings', Settings],
  ['logs', 'Logs / Notifications', Bell],
];
const yen = (n: number) =>
  new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(n);
const settingText = (v: unknown, fallback: string) =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : fallback;

export default function AdminDashboard({
  section = '' as Section,
}: {
  section?: string;
}) {
  const [active, setActive] = useState<Section>(
      (nav.some((n) => n[0] === section) ? section : '') as Section,
    ),
    [data, setData] = useState<Data>(empty),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/data', { cache: 'no-store' });
      if (!r.ok) throw new Error(`データ取得に失敗しました (${r.status})`);
      setData((await r.json()) as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    const sync = () => {
      const key = location.pathname
        .replace(/^\/admin\/?/, '')
        .split('/')[0] as Section;
      setActive(nav.some((n) => n[0] === key) ? key : '');
    };
    addEventListener('popstate', sync);
    return () => removeEventListener('popstate', sync);
  }, []);
  const go = (next: Section) => {
    setActive(next);
    history.pushState(null, '', `/admin${next ? `/${next}` : ''}`);
  };
  const patch = async (
    entity: string,
    id: string,
    body: Record<string, unknown>,
  ) => {
    const r = await fetch(`/api/admin/entity/${entity}/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('保存できませんでした');
    await load();
  };
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button className="admin-brand nav-button" onClick={() => go('')}>
          <b>WWW</b>
          <span>OPERATIONS</span>
        </button>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={active === key ? 'active' : ''}
              onClick={() => go(key)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-user">
          <span>AH</span>
          <div>
            <b>akiyama haruto</b>
            <small>Owner</small>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div>
            <p>WINE WORK WOMEN</p>
            <b>{nav.find((n) => n[0] === active)?.[1]}</b>
          </div>
          <div className="admin-actions">
            <button onClick={() => void load()} aria-label="再読み込み">
              <RefreshCw size={18} />
            </button>
            <a href="/" target="_blank">
              サイトを確認 <ChevronRight size={15} />
            </a>
          </div>
        </header>
        <div className="admin-content">
          {loading && <div className="state-banner">読み込み中…</div>}
          {error && (
            <div className="state-banner error">
              <span>{error}</span>
              <button onClick={() => void load()}>再試行</button>
            </div>
          )}
          {!loading && (
            <Module section={active} data={data} patch={patch} reload={load} />
          )}
        </div>
      </main>
    </div>
  );
}
function Heading({
  title,
  desc,
  action,
}: {
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
}
function Module({
  section,
  data,
  patch,
  reload,
}: {
  section: Section;
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  switch (section) {
    case 'members':
      return <Members data={data} patch={patch} reload={reload} />;
    case 'events':
      return <Events data={data} patch={patch} reload={reload} />;
    case 'applications':
      return <Applications data={data} patch={patch} />;
    case 'payments':
      return <Payments data={data} patch={patch} />;
    case 'contents':
      return <Contents data={data} patch={patch} reload={reload} />;
    case 'pages':
      return <Pages data={data} patch={patch} />;
    case 'analytics':
      return <Analytics data={data} />;
    case 'manual':
      return <Manual />;
    case 'settings':
      return <SettingsPage data={data} reload={reload} />;
    case 'logs':
      return <Logs data={data} patch={patch} />;
    default:
      return <Dashboard data={data} />;
  }
}
function Dashboard({ data }: { data: Data }) {
  const month = new Date().toISOString().slice(0, 7),
    pv = data.analytics
      .filter(
        (a) => a.event_type === 'page_view' || a.event_type === 'content_view',
      )
      .reduce((n, a) => n + a.value, 0),
    popular = [...data.analytics].sort((a, b) => b.value - a.value)[0];
  const p = paymentSummary(data.payments),
    active = data.members.filter((m) => m.status === 'active').length,
    pause = data.members.filter((m) => m.status === 'pause').length,
    next = data.events[0],
    published = data.contents.filter((c) => c.status === 'published').length,
    newMembers = data.members.filter((m) =>
      m.created_at?.startsWith(month),
    ).length,
    churned = data.members.filter((m) => m.status === 'churned').length,
    monthlyContents = data.contents.filter((c) =>
      c.published_at?.startsWith(month),
    ).length;
  return (
    <>
      <Heading
        title="運営ダッシュボード"
        desc={`${new Date().toLocaleDateString('ja-JP')}・D1の最新状況`}
      />
      {data.notifications.filter((n) => !n.read_at).length > 0 && (
        <div className="alert-line">
          <b>要対応 {data.notifications.filter((n) => !n.read_at).length}件</b>
          <span>{data.notifications.find((n) => !n.read_at)?.title}</span>
        </div>
      )}
      <section className="stats">
        <Stat label="ACTIVE会員" value={String(active)} />
        <Stat label="今月新規" value={String(newMembers)} />
        <Stat label="PAUSE" value={String(pause)} />
        <Stat label="退会" value={String(churned)} />
        <Stat
          label="未入金"
          value={String(p.unpaidCount)}
          sub={yen(p.outstanding)}
        />
        <Stat
          label="今月公開Contents"
          value={String(monthlyContents)}
          sub={`全公開 ${published}`}
        />
        <Stat
          label="主要記事PV"
          value={String(pv)}
          sub={popular?.path || 'データなし'}
        />
        <Stat label="人気Category" value={popular?.entity_id || '未計測'} />
        <Stat label="会費売上" value="未計測" />
        <Stat label="Event売上" value={yen(p.collected)} />
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>次回イベント</h2>
          </div>
          {next ? (
            <div className="next-event">
              <div className="date-tile">
                <b>{next.date?.slice(-2)}</b>
                <span>EVENT</span>
              </div>
              <div>
                <h3>{next.title}</h3>
                <p>
                  {next.date} · {next.venue}
                </p>
                <div className="capacity">
                  <i
                    style={{
                      width: `${Math.min(100, (next.applications / next.capacity) * 100)}%`,
                    }}
                  />
                  <span>
                    {next.applications} / {next.capacity}名
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <Empty />
          )}
        </section>
        <section className="panel">
          <h2>売上状況</h2>
          <div className="mini-bars">
            <div>
              <span>回収予定</span>
              <b>{yen(p.expected)}</b>
            </div>
            <div>
              <span>回収済</span>
              <b>{yen(p.collected)}</b>
            </div>
            <div>
              <span>回収率</span>
              <b>{p.rate}%</b>
            </div>
          </div>
        </section>
      </div>
      <section className="panel table-panel">
        <table>
          <TableHead labels={['未入金', 'イベント', '金額', '状態']} />
          <tbody>
            {data.payments
              .filter((x) => x.status === 'unpaid')
              .map((x) => (
                <tr key={x.id}>
                  <td>
                    <b>{x.name}</b>
                  </td>
                  <td>{x.event}</td>
                  <td>{yen(x.amount)}</td>
                  <td>
                    <Badge text="未入金" tone="warning" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>最近公開Content</h2>
          {data.contents
            .filter((c) => c.status === 'published')
            .slice(0, 5)
            .map((c) => (
              <div className="placement-row" key={c.id}>
                <b>{c.title}</b>
                <span>{c.published_at?.slice(0, 10) || '公開日なし'}</span>
              </div>
            ))}
        </section>
        <section className="panel">
          <h2>Notifications</h2>
          {data.notifications.slice(0, 5).map((n) => (
            <div className="placement-row" key={n.id}>
              <b>{n.title}</b>
              <span>{n.read_at ? '既読' : '未読'}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}
function Members({
  data,
  patch,
  reload,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [q, setQ] = useState(''),
    [adding, setAdding] = useState(false),
    [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<string | null>(null);
  const rows = data.members.filter(
    (m) =>
      (status === 'all' || m.status === status) &&
      (m.name + (m.email || '')).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Members"
        desc={`${data.members.length}名の会員情報`}
        action={
          <button className="admin-primary" onClick={() => setAdding(!adding)}>
            ＋ 会員を追加
          </button>
        }
      />
      {adding && (
        <CreateMember
          done={async () => {
            setAdding(false);
            await reload();
          }}
        />
      )}
      <div className="toolbar">
        <input
          aria-label="会員検索"
          placeholder="名前・メールで検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="会員ステータスFilter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全Status</option>
          <option value="candidate">candidate</option>
          <option value="invited">invited</option>
          <option value="active">active</option>
          <option value="pause">pause</option>
          <option value="churned">churned</option>
        </select>
        <a className="toolbar-link" href="/api/admin/members.csv">
          CSV Export
        </a>
      </div>
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={[
              '会員',
              'ステータス',
              '入会日',
              '流入',
              '最終接触',
              '操作',
            ]}
          />
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <b>{m.name}</b>
                  <small>{m.email}</small>
                </td>
                <td>
                  <select
                    aria-label={`${m.name} ステータス`}
                    className={`status-select ${m.status}`}
                    value={m.status}
                    onChange={(e) =>
                      void patch('members', m.id, { status: e.target.value })
                    }
                  >
                    <option value="candidate">候補</option>
                    <option value="invited">招待中</option>
                    <option value="active">ACTIVE</option>
                    <option value="pause">PAUSE</option>
                    <option value="churned">退会</option>
                  </select>
                </td>
                <td>{m.joined}</td>
                <td>{m.source}</td>
                <td>{m.lastContact}</td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => setSelected(selected === m.id ? null : m.id)}
                  >
                    詳細 / Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {selected && (
        <MemberEditor
          member={data.members.find((m) => m.id === selected)!}
          patch={patch}
          reload={reload}
        />
      )}
    </>
  );
}
function MemberEditor({
  member,
  patch,
  reload,
}: {
  member: Member;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('保存中…');
    const b = Object.fromEntries(new FormData(e.currentTarget));
    await patch('members', member.id, {
      ...b,
      interest_categories: (typeof b.interest_categories === 'string'
        ? b.interest_categories
        : ''
      )
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    });
    setMessage('保存しました');
  };
  const archive = async () => {
    if (!confirm('この会員をArchiveしますか？')) return;
    const r = await fetch(`/api/admin/entity/members/${member.id}`, {
      method: 'DELETE',
    });
    setMessage(r.ok ? 'Archiveしました' : 'Archiveできませんでした');
    if (r.ok) await reload();
  };
  return (
    <form className="panel settings-form" onSubmit={submit}>
      <h2>{member.name} / Detail</h2>
      <label>
        氏名
        <input name="name" defaultValue={member.name} />
      </label>
      <label>
        LINE
        <input name="line_name" defaultValue={member.line || ''} />
      </label>
      <label>
        Email
        <input name="email" type="email" defaultValue={member.email || ''} />
      </label>
      <label>
        Source
        <input name="source" defaultValue={member.source || ''} />
      </label>
      <label>
        最終接触
        <input
          name="last_contact_at"
          type="date"
          defaultValue={member.lastContact || ''}
        />
      </label>
      <label>
        興味Category
        <input
          name="interest_categories"
          defaultValue={member.interestCategories || ''}
        />
      </label>
      <label>
        Memo
        <textarea name="notes" defaultValue={member.notes || ''} />
      </label>
      <div>
        <button className="admin-primary">保存</button>
        <button
          type="button"
          className="small-button"
          onClick={() => void archive()}
        >
          Archive
        </button>
      </div>
      <output>{message}</output>
    </form>
  );
}
function CreateMember({ done }: { done: () => Promise<void> }) {
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch('/api/admin/entity/members', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(b),
    });
    if (r.ok) await done();
  };
  return (
    <form className="panel quick-form" onSubmit={submit}>
      <input name="name" placeholder="氏名" required />
      <input name="email" type="email" placeholder="メール" />
      <select name="status" defaultValue="candidate">
        <option value="candidate">候補</option>
        <option value="active">ACTIVE</option>
      </select>
      <input name="source" placeholder="流入経路" />
      <button className="admin-primary">保存</button>
    </form>
  );
}
function Events({
  data,
  patch,
  reload,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [q, setQ] = useState('');
  const rows = data.events.filter((e) =>
    (e.title + e.venue).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Events"
        desc={`${data.events.length}件・公開と受付を即時反映`}
        action={
          <button className="admin-primary" onClick={() => setAdding(!adding)}>
            ＋ イベントを作成
          </button>
        }
      />
      {adding && (
        <CreateEvent
          done={async () => {
            setAdding(false);
            await reload();
          }}
        />
      )}
      <div className="toolbar">
        <input
          aria-label="イベント検索"
          placeholder="イベント名・会場で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={[
              'イベント',
              '日程 / 会場',
              '申込',
              '価格',
              'Public',
              'Member',
              '受付',
              'Waitlist',
              '操作',
            ]}
          />
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  <b>{e.title}</b>
                  <small>{e.slug}</small>
                </td>
                <td>
                  {e.date}
                  <small>{e.venue}</small>
                </td>
                <td>
                  {e.applications} / {e.capacity}
                </td>
                <td>{yen(e.price)}</td>
                <td>
                  <Switch
                    checked={e.status === 'published'}
                    label={`${e.title} 公開`}
                    change={(v) =>
                      patch('events', e.id, {
                        publish_status: v ? 'published' : 'draft',
                        public_visible: v,
                      })
                    }
                  />
                </td>
                <td>
                  <Switch
                    checked={Boolean(e.member_visible)}
                    label={`${e.title} Member`}
                    change={(v) => patch('events', e.id, { member_visible: v })}
                  />
                </td>
                <td>
                  <Switch
                    checked={Boolean(e.registration_enabled)}
                    label={`${e.title} 受付`}
                    change={(v) =>
                      patch('events', e.id, { registration_enabled: v })
                    }
                  />
                </td>
                <td>
                  <Switch
                    checked={Boolean(e.waitlist_enabled)}
                    label={`${e.title} Waitlist`}
                    change={(v) =>
                      patch('events', e.id, { waitlist_enabled: v })
                    }
                  />
                </td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => setSelected(selected === e.id ? null : e.id)}
                  >
                    Detail / Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {selected && (
        <EventEditor
          event={data.events.find((e) => e.id === selected)!}
          patch={patch}
          reload={reload}
        />
      )}
    </>
  );
}
function CreateEvent({ done }: { done: () => Promise<void> }) {
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch('/api/admin/entity/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...b,
        capacity: Number(b.capacity),
        price: Number(b.price),
        registration_enabled: true,
        waitlist_enabled: true,
      }),
    });
    if (r.ok) await done();
  };
  return (
    <form className="panel quick-form wide" onSubmit={submit}>
      <input name="title" placeholder="イベント名" required />
      <input name="slug" placeholder="slug" required />
      <input name="start_at" type="datetime-local" required />
      <input name="end_at" type="datetime-local" required />
      <input name="venue" placeholder="会場" required />
      <input name="event_type" placeholder="イベント種別" />
      <input
        name="capacity"
        type="number"
        min="1"
        placeholder="定員"
        required
      />
      <input name="price" type="number" min="0" placeholder="価格" required />
      <textarea name="description" placeholder="説明" />
      <input name="items_to_bring" placeholder="持ち物" />
      <input name="precautions" placeholder="注意事項" />
      <button className="admin-primary">下書き保存</button>
    </form>
  );
}
function EventEditor({
  event,
  patch,
  reload,
}: {
  event: EventRow;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('保存中…');
    const b = Object.fromEntries(new FormData(e.currentTarget));
    await patch('events', event.id, {
      ...b,
      capacity: Number(b.capacity),
      price: Number(b.price),
    });
    setMessage('保存しました');
  };
  const duplicate = async () => {
    const body = {
      ...event,
      title: `${event.title} Copy`,
      slug: `${event.slug}-copy-${Date.now()}`,
      publish_status: 'draft',
      public_visible: false,
      member_visible: false,
    };
    const r = await fetch('/api/admin/entity/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(r.ok ? '複製しました' : '複製できませんでした');
    if (r.ok) await reload();
  };
  const archive = async () => {
    if (!confirm('このEventをArchiveしますか？')) return;
    await patch('events', event.id, {
      archived_at: new Date().toISOString(),
      publish_status: 'archived',
      public_visible: false,
      member_visible: false,
      registration_enabled: false,
    });
    setMessage('Archiveしました');
  };
  return (
    <form className="panel settings-form" onSubmit={submit}>
      <h2>{event.title} / Detail</h2>
      <label>
        Event名
        <input name="title" defaultValue={event.title} />
      </label>
      <label>
        Slug
        <input name="slug" defaultValue={event.slug} />
      </label>
      <label>
        Type
        <input name="event_type" defaultValue={event.event_type} />
      </label>
      <label>
        開始
        <input name="start_at" defaultValue={event.start_at} />
      </label>
      <label>
        終了
        <input name="end_at" defaultValue={event.end_at} />
      </label>
      <label>
        会場
        <input name="venue" defaultValue={event.venue} />
      </label>
      <label>
        定員
        <input name="capacity" type="number" defaultValue={event.capacity} />
      </label>
      <label>
        参加費
        <input name="price" type="number" defaultValue={event.price} />
      </label>
      <label>
        説明
        <textarea name="description" defaultValue={event.description || ''} />
      </label>
      <label>
        持ち物
        <textarea
          name="items_to_bring"
          defaultValue={event.items_to_bring || ''}
        />
      </label>
      <label>
        注意事項
        <textarea name="precautions" defaultValue={event.precautions || ''} />
      </label>
      <div>
        <button className="admin-primary">保存</button>
        <button
          type="button"
          className="small-button"
          onClick={() => void duplicate()}
        >
          複製
        </button>
        <button
          type="button"
          className="small-button"
          onClick={() => void archive()}
        >
          Archive
        </button>
      </div>
      <output>{message}</output>
    </form>
  );
}
function Applications({
  data,
  patch,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
}) {
  const [q, setQ] = useState(''),
    [status, setStatus] = useState('all'),
    [payment, setPayment] = useState('all'),
    [eventId, setEventId] = useState('all');
  const rows = data.applications.filter(
    (a) =>
      (status === 'all' || a.application_status === status) &&
      (payment === 'all' || a.payment_status === payment) &&
      (eventId === 'all' || a.event_id === eventId) &&
      (a.name + a.email + a.event_title)
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Event Applications"
        desc={`${data.applications.length}件の申込`}
      />
      <div className="toolbar">
        <input
          aria-label="申込検索"
          placeholder="氏名・メール・イベント"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="申込Status Filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全Status</option>
          {[
            'pending',
            'approved',
            'waitlist',
            'cancelled',
            'attended',
            'no_show',
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Payment Filter"
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
        >
          <option value="all">全Payment</option>
          <option>unpaid</option>
          <option>paid</option>
          <option>refunded</option>
          <option>waived</option>
        </select>
        <select
          aria-label="Event Filter"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="all">全Event</option>
          {data.events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={[
              '参加者',
              'Memo',
              'イベント',
              '申込日時',
              '申込状態',
              '支払い',
              '当日',
            ]}
          />
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <b>{a.name}</b>
                  <small>{a.email}</small>
                </td>
                <td>
                  <input
                    aria-label={`${a.name} Memo`}
                    defaultValue={a.notes || ''}
                    onBlur={(e) =>
                      void patch('event_applications', a.id, {
                        notes: e.target.value,
                      })
                    }
                  />
                </td>
                <td>{a.event_title}</td>
                <td>{a.applied_at?.slice(0, 10)}</td>
                <td>
                  <select
                    aria-label={`${a.name} 申込状態`}
                    value={a.application_status}
                    onChange={(e) =>
                      void patch('event_applications', a.id, {
                        application_status: e.target.value,
                      })
                    }
                  >
                    <option value="pending">保留</option>
                    <option value="approved">承認</option>
                    <option value="waitlist">Waitlist</option>
                    <option value="cancelled">キャンセル</option>
                    <option value="attended">出席</option>
                    <option value="no_show">No-show</option>
                  </select>
                </td>
                <td>
                  <Badge
                    text={a.payment_status === 'paid' ? '入金済み' : '未入金'}
                    tone={a.payment_status === 'paid' ? 'success' : 'warning'}
                  />
                </td>
                <td>
                  <button
                    className="small-button"
                    onClick={() =>
                      void patch('event_applications', a.id, {
                        application_status: 'attended',
                      })
                    }
                  >
                    出席
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
function Payments({
  data,
  patch,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
}) {
  const s = paymentSummary(data.payments),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('all'),
    rows = data.payments.filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (p.name + p.event).toLowerCase().includes(q.toLowerCase()),
    );
  return (
    <>
      <Heading
        title="Payments"
        desc="イベント参加費のみ（月額会費は会費ペイ）"
      />
      <div className="toolbar">
        <input
          aria-label="入金検索"
          placeholder="氏名・イベント"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="入金Status Filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全Status</option>
          <option>unpaid</option>
          <option>paid</option>
          <option>refunded</option>
          <option>waived</option>
        </select>
      </div>
      <section className="stats">
        <Stat label="回収予定" value={yen(s.expected)} />
        <Stat label="回収済" value={yen(s.collected)} />
        <Stat label="未回収" value={yen(s.outstanding)} />
        <Stat label="回収率" value={`${s.rate}%`} />
      </section>
      <section className="panel payment-list">
        {rows.map((p) => (
          <div key={p.id}>
            <div>
              <b>{p.name}</b>
              <small>{p.event}</small>
            </div>
            <strong>{yen(p.amount)}</strong>
            <Badge
              text={p.status === 'paid' ? '入金済' : '未入金'}
              tone={p.status === 'paid' ? 'success' : 'warning'}
            />
            <Switch
              checked={p.status === 'paid'}
              label={`${p.name} 入金`}
              change={(v) =>
                patch('event_payments', p.id, {
                  status: v ? 'paid' : 'unpaid',
                  paid_at: v ? new Date().toISOString() : null,
                })
              }
            />
          </div>
        ))}
      </section>
    </>
  );
}
function Contents({
  data,
  patch,
  reload,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [q, setQ] = useState(''),
    [type, setType] = useState('all'),
    [status, setStatus] = useState('all');
  const rows = data.contents.filter(
    (c) =>
      (type === 'all' || c.type === type) &&
      (status === 'all' || c.status === status) &&
      (c.title + c.summary).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Contents"
        desc={`${data.contents.length}件・掲載先を独立管理`}
        action={
          <button className="admin-primary" onClick={() => setAdding(!adding)}>
            ＋ コンテンツを作成
          </button>
        }
      />
      {adding && (
        <CreateContent
          done={async () => {
            setAdding(false);
            await reload();
          }}
        />
      )}
      <MediaUploader contents={data.contents} done={reload} />
      <div className="toolbar">
        <input
          aria-label="Content検索"
          placeholder="タイトル・概要"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Content Type Filter"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">全Type</option>
          {[
            'PEOPLE',
            'FIELD',
            'TABLE',
            'NEWS',
            'EVENT_REPORT',
            'GUIDE',
            'FAQ',
            'FEATURE',
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Content Status Filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">全Status</option>
          <option>draft</option>
          <option>published</option>
          <option>archived</option>
        </select>
      </div>
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={[
              'コンテンツ',
              'タイプ',
              'Public',
              'Member',
              '状態',
              '操作',
            ]}
          />
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.title}</b>
                  <small>{c.summary}</small>
                </td>
                <td>
                  <Badge text={c.type} />
                </td>
                <td>
                  <Switch
                    checked={Boolean(c.publicVisible)}
                    label={`${c.title} Public`}
                    change={(v) =>
                      patch('contents', c.id, { public_visible: v })
                    }
                  />
                </td>
                <td>
                  <Switch
                    checked={Boolean(c.memberVisible)}
                    label={`${c.title} Member`}
                    change={(v) =>
                      patch('contents', c.id, { member_visible: v })
                    }
                  />
                </td>
                <td>
                  <select
                    value={c.status}
                    aria-label={`${c.title} 公開状態`}
                    onChange={(e) =>
                      void patch('contents', c.id, {
                        publish_status: e.target.value,
                        published_at:
                          e.target.value === 'published'
                            ? new Date().toISOString()
                            : null,
                      })
                    }
                  >
                    <option value="draft">下書き</option>
                    <option value="published">公開</option>
                    <option value="archived">アーカイブ</option>
                  </select>
                </td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => setSelected(selected === c.id ? null : c.id)}
                  >
                    Detail / Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {selected && (
        <ContentEditor
          content={data.contents.find((c) => c.id === selected)!}
          patch={patch}
          reload={reload}
        />
      )}
    </>
  );
}
function ContentEditor({
  content,
  patch,
  reload,
}: {
  content: Content;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('保存中…');
    const b = Object.fromEntries(new FormData(e.currentTarget));
    await patch('contents', content.id, {
      ...b,
      tags: (typeof b.tags === 'string' ? b.tags : '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    });
    setMessage('保存しました');
  };
  const duplicate = async () => {
    const body = {
      ...content,
      title: `${content.title} Copy`,
      slug: `${content.slug}-copy-${Date.now()}`,
      publish_status: 'draft',
      public_visible: false,
      member_visible: false,
    };
    const r = await fetch('/api/admin/entity/contents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    setMessage(r.ok ? '複製しました' : '複製できませんでした');
    if (r.ok) await reload();
  };
  const archive = async () => {
    if (!confirm('このContentをArchiveしますか？')) return;
    await patch('contents', content.id, {
      archived_at: new Date().toISOString(),
      publish_status: 'archived',
      public_visible: false,
      member_visible: false,
    });
    setMessage('Archiveしました');
  };
  return (
    <form className="panel settings-form" onSubmit={submit}>
      <h2>{content.title} / Detail</h2>
      <label>
        Title
        <input name="title" defaultValue={content.title} />
      </label>
      <label>
        Slug
        <input name="slug" defaultValue={content.slug} />
      </label>
      <label>
        Type
        <select name="type" defaultValue={content.type}>
          {[
            'PEOPLE',
            'FIELD',
            'TABLE',
            'NEWS',
            'EVENT_REPORT',
            'GUIDE',
            'FAQ',
            'FEATURE',
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Summary
        <textarea name="summary" defaultValue={content.summary} />
      </label>
      <label>
        Body
        <textarea name="body" defaultValue={content.body} />
      </label>
      <label>
        Tags
        <input name="tags" defaultValue={content.tags || ''} />
      </label>
      <label>
        Cover Image
        <input value={content.cover_image || ''} readOnly />
      </label>
      <label>
        Audio
        <input value={content.audio || ''} readOnly />
      </label>
      <div>
        <button className="admin-primary">保存</button>
        <button
          type="button"
          className="small-button"
          onClick={() => void duplicate()}
        >
          複製
        </button>
        <a
          className="small-button"
          href={`/member/${content.type.toLowerCase()}/${content.slug}`}
          target="_blank"
        >
          Preview
        </a>
        <button
          type="button"
          className="small-button"
          onClick={() => void archive()}
        >
          Archive
        </button>
      </div>
      <output>{message}</output>
    </form>
  );
}
function CreateContent({ done }: { done: () => Promise<void> }) {
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const payload: Record<string, unknown> = {
      ...b,
      tags:
        typeof b.tags === 'string'
          ? b.tags
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
    };
    const r = await fetch('/api/admin/entity/contents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) await done();
  };
  return (
    <form className="panel quick-form wide" onSubmit={submit}>
      <select name="type">
        <option>PEOPLE</option>
        <option>FIELD</option>
        <option>TABLE</option>
        <option>NEWS</option>
        <option>EVENT_REPORT</option>
        <option>GUIDE</option>
        <option>FAQ</option>
        <option>FEATURE</option>
      </select>
      <input name="title" placeholder="タイトル" required />
      <input name="slug" placeholder="slug" required />
      <input name="summary" placeholder="概要" />
      <input name="tags" placeholder="タグ（カンマ区切り）" />
      <textarea name="body" placeholder="本文" required />
      <select name="publish_status" defaultValue="draft">
        <option value="draft">下書き</option>
        <option value="published">公開</option>
      </select>
      <button className="admin-primary">下書き保存</button>
    </form>
  );
}
function MediaUploader({
  contents,
  done,
}: {
  contents: Content[];
  done: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('アップロード中…');
    const r = await fetch('/api/admin/media', {
      method: 'POST',
      body: new FormData(e.currentTarget),
    });
    setMessage(r.ok ? 'アップロードしました' : 'アップロードできませんでした');
    if (r.ok) await done();
  };
  return (
    <form className="panel quick-form" onSubmit={submit}>
      <select name="contentId" required>
        <option value="">Contentを選択</option>
        {contents.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input
        name="file"
        type="file"
        accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4"
        required
      />
      <input name="alt" placeholder="代替テキスト" />
      <button className="admin-primary">Media Upload</button>
      <span>{message}</span>
    </form>
  );
}
function Pages({
  data,
  patch,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <>
      <Heading title="Library / Pages" desc="表示先ごとの掲載状況" />
      <section className="panel">
        <div className="placement-row">
          <b>Public</b>
          <span>{data.contents.filter((c) => c.publicVisible).length}件</span>
        </div>
        <div className="placement-row">
          <b>Member</b>
          <span>{data.contents.filter((c) => c.memberVisible).length}件</span>
        </div>
        <div className="placement-row">
          <b>非掲載</b>
          <span>
            {
              data.contents.filter((c) => !c.publicVisible && !c.memberVisible)
                .length
            }
            件
          </span>
        </div>
      </section>
      <section className="panel placement-list">
        {data.placements.length ? (
          data.placements.map((p) => (
            <div key={p.id}>
              <b>{p.title}</b>
              <span>{p.surface}</span>
              <label>
                順番
                <input
                  type="number"
                  min="0"
                  value={p.position}
                  onChange={(e) =>
                    void patch('content_placements', p.id, {
                      position: Number(e.target.value),
                    })
                  }
                />
              </label>
              <Switch
                checked={Boolean(p.featured)}
                label={`${p.title} Featured`}
                change={(v) =>
                  patch('content_placements', p.id, { featured: v })
                }
              />
              <Switch
                checked={Boolean(p.pinned)}
                label={`${p.title} Pin`}
                change={(v) => patch('content_placements', p.id, { pinned: v })}
              />
              <Switch
                checked={Boolean(p.is_new)}
                label={`${p.title} New`}
                change={(v) => patch('content_placements', p.id, { is_new: v })}
              />
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function Analytics({ data }: { data: Data }) {
  const active = data.members.filter((m) => m.status === 'active').length,
    s = paymentSummary(data.payments);
  return (
    <>
      <Heading title="Analytics" desc="取得できる実データのみ表示" />
      <section className="stats">
        <Stat label="ACTIVE Members" value={String(active)} />
        <Stat label="Event Revenue" value={yen(s.collected)} />
        <Stat
          label="Event参加率"
          value={
            data.applications.length
              ? `${Math.round((data.applications.filter((a) => a.application_status === 'attended').length / data.applications.length) * 100)}%`
              : '未計測'
          }
        />
        <Stat label="LTV" value="未計測" />
      </section>
      <section className="panel">
        <h2>計測内訳</h2>
        {data.analytics.length ? (
          data.analytics.map((a, i) => (
            <div
              className="placement-row"
              key={`${a.event_type}-${a.path}-${i}`}
            >
              <b>{a.event_type}</b>
              <span>
                {a.path} · PV {a.value} · Session {a.sessions}
              </span>
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function Manual() {
  const groups = [
    [
      '最初に行うこと',
      [
        'Dashboardで未読通知・次回イベント・未決済件数を確認',
        '左メニューから目的の管理画面へ移動',
        '変更後は公開ページまたは会員ページで表示を確認',
      ],
    ],
    [
      'Members',
      [
        '検索と状態フィルターで会員を絞り込み',
        '新規作成または行を開いて連絡先・状態・メモを更新',
        'CSV出力は現在の会員一覧を保存',
      ],
    ],
    [
      'Events / Applications',
      [
        'Eventsで日程・会場・定員・公開範囲・申込可否を設定',
        '複製は元イベントを残したまま下書きを作成',
        'Applicationsで参加状態・決済状態・運営メモを更新',
      ],
    ],
    [
      'Payments',
      [
        '検索と状態フィルターで未決済を確認',
        '入金確認後に決済状態を更新',
        '外部決済サービスとの照合結果を基準に操作',
      ],
    ],
    [
      'Contents / Library',
      [
        'Contentsで記事種別・本文・画像・音声・公開範囲を設定',
        'プレビューで内容を確認してからpublishedへ変更',
        'Library / Pagesで表示順・Featured・Pin・Newを調整',
      ],
    ],
    [
      'Analytics / Settings',
      [
        'Analyticsは実際に取得できた閲覧・参加データを表示',
        'Settingsでサイト名・連絡先・分類を管理',
        'Member Password変更は全会員セッションを失効するため必要時のみ実行',
      ],
    ],
    [
      'Logs / Notifications',
      [
        '通知を確認して対応済みなら既読へ変更',
        '監査ログで日時・操作者・操作対象を確認',
        '不具合時は対象画面・操作時刻・表示文言を記録',
      ],
    ],
  ];
  return (
    <>
      <Heading title="操作説明書" desc="Wine Work Women 運営管理の基本手順" />
      <section className="manual-grid">
        {groups.map(([title, items]) => (
          <article className="panel" key={title as string}>
            <h2>{title as string}</h2>
            <ol>
              {(items as string[]).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>
      <section className="panel manual-caution">
        <h2>公開前チェック</h2>
        <p>
          公開範囲、日時、申込可否、リンク先、スマートフォン表示を確認してください。パスワード変更やアーカイブは影響範囲を確認してから実行します。
        </p>
      </section>
    </>
  );
}
function SettingsPage({
  data,
  reload,
}: {
  data: Data;
  reload: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const r = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    setMessage(r.ok ? '保存しました' : '保存できませんでした');
    if (r.ok) await reload();
  };
  return (
    <>
      <Heading title="Settings" desc="サイトと会員認証の設定" />
      <form className="panel settings-form" onSubmit={submit}>
        <label>
          Site Name
          <input
            name="site_name"
            defaultValue={settingText(
              data.settings.site_name,
              'Wine Work Women',
            )}
          />
        </label>
        <label>
          Site URL
          <input
            name="site_url"
            type="url"
            defaultValue={settingText(
              data.settings.site_url,
              'https://wine-work-women-core.harusanx552653.chatgpt.site',
            )}
          />
        </label>
        <label>
          Contact
          <input
            name="contact"
            type="email"
            defaultValue={settingText(data.settings.contact, '')}
          />
        </label>
        <label>
          Session
          <select
            name="session_lifetime_days"
            defaultValue={settingText(
              data.settings.session_lifetime_days,
              '30',
            )}
          >
            <option value="7">7日</option>
            <option value="30">30日</option>
            <option value="90">90日</option>
          </select>
        </label>
        <label>
          Categories
          <input
            name="categories"
            defaultValue={settingText(
              data.settings.categories,
              'PEOPLE,FIELD,TABLE,NEWS',
            )}
          />
        </label>
        <label>
          Tags
          <input
            name="tags"
            defaultValue={settingText(data.settings.tags, '')}
          />
        </label>
        <label>
          Event Types
          <input
            name="event_types"
            defaultValue={settingText(
              data.settings.event_types,
              'FIELD訪問,食事会,セミナー',
            )}
          />
        </label>
        <label>
          Notification Settings
          <select
            name="notification_settings"
            defaultValue={settingText(
              data.settings.notification_settings,
              'important',
            )}
          >
            <option value="important">重要のみ</option>
            <option value="all">すべて</option>
            <option value="off">OFF</option>
          </select>
        </label>
        <button className="admin-primary">保存</button>
      </form>
      {message && <div className="state-banner">{message}</div>}
      <section className="panel">
        <h2>Admin Users / Role</h2>
        {data.adminUsers.map((u) => (
          <div className="placement-row" key={u.access_email}>
            <b>{u.access_email}</b>
            <span>{u.role}</span>
          </div>
        ))}
      </section>
      <form className="panel danger-zone" onSubmit={submit}>
        <h2>Member Password</h2>
        <input name="member_password" type="password" minLength={12} required />
        <button>変更して全Sessionを失効</button>
      </form>
    </>
  );
}
function Logs({
  data,
  patch,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <>
      <Heading title="Logs / Notifications" desc="重要操作の監査履歴" />
      <section className="panel">
        <h2>Notifications</h2>
        {data.notifications.length ? (
          data.notifications.map((n) => (
            <div className="placement-row" key={n.id}>
              <div>
                <b>{n.title}</b>
                <small>{n.body}</small>
              </div>
              <button
                className="small-button"
                onClick={() =>
                  void patch('notifications', n.id, {
                    read_at: n.read_at ? null : new Date().toISOString(),
                  })
                }
              >
                {n.read_at ? '未読に戻す' : '既読'}
              </button>
            </div>
          ))
        ) : (
          <Empty />
        )}
      </section>
      <section className="panel table-panel">
        <table>
          <TableHead labels={['日時', '操作者', '操作', '対象', 'ID']} />
          <tbody>
            {data.logs.map((l) => (
              <tr key={l.id}>
                <td>{l.created_at?.slice(0, 16).replace('T', ' ')}</td>
                <td>{l.actor}</td>
                <td>{l.action}</td>
                <td>{l.entity_type}</td>
                <td>{l.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
function Switch({
  checked,
  label,
  change,
}: {
  checked: boolean;
  label: string;
  change: (v: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState(checked),
    [busy, setBusy] = useState(false);
  useEffect(() => setValue(checked), [checked]);
  return (
    <label className="switch" aria-label={label}>
      <input
        type="checkbox"
        checked={value}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.checked;
          setValue(next);
          setBusy(true);
          try {
            await change(next);
          } catch {
            setValue(!next);
          } finally {
            setBusy(false);
          }
        }}
      />
      <span />
    </label>
  );
}
function Badge({ text, tone = 'neutral' }: { text: string; tone?: string }) {
  return <span className={`badge ${tone}`}>{text}</span>;
}
function TableHead({ labels }: { labels: string[] }) {
  return (
    <thead>
      <tr>
        {labels.map((x) => (
          <th key={x}>{x}</th>
        ))}
      </tr>
    </thead>
  );
}
function Empty() {
  return <p className="empty-copy">データはまだありません。</p>;
}
