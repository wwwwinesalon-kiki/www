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
    [adding, setAdding] = useState(false);
  const rows = data.members.filter((m) =>
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
        <a className="toolbar-link" href="/api/admin/members.csv">
          CSV Export
        </a>
      </div>
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={['会員', 'ステータス', '入会日', '流入', '最終接触']}
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
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
  const [adding, setAdding] = useState(false);
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
            ]}
          />
          <tbody>
            {data.events.map((e) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>
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
function Applications({
  data,
  patch,
}: {
  data: Data;
  patch: (e: string, id: string, b: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <>
      <Heading
        title="Event Applications"
        desc={`${data.applications.length}件の申込`}
      />
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={[
              '参加者',
              'イベント',
              '申込日時',
              '申込状態',
              '支払い',
              '当日',
            ]}
          />
          <tbody>
            {data.applications.map((a) => (
              <tr key={a.id}>
                <td>
                  <b>{a.name}</b>
                  <small>{a.email}</small>
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
  const s = paymentSummary(data.payments);
  return (
    <>
      <Heading
        title="Payments"
        desc="イベント参加費のみ（月額会費は会費ペイ）"
      />
      <section className="stats">
        <Stat label="回収予定" value={yen(s.expected)} />
        <Stat label="回収済" value={yen(s.collected)} />
        <Stat label="未回収" value={yen(s.outstanding)} />
        <Stat label="回収率" value={`${s.rate}%`} />
      </section>
      <section className="panel payment-list">
        {data.payments.map((p) => (
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
  const [adding, setAdding] = useState(false);
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
      <section className="panel table-panel">
        <table>
          <TableHead
            labels={['コンテンツ', 'タイプ', 'Public', 'Member', '状態']}
          />
          <tbody>
            {data.contents.map((c) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
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
