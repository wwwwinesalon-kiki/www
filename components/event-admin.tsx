'use client';

import { useState } from 'react';
import KaihipayManagementLinks from '@/components/kaihipay-management-links';

type Event = {
  id: string;
  title: string;
  slug: string;
  status: string;
  venue: string;
  event_type: string;
  start_at: string;
  end_at: string;
  capacity: number;
  applications: number;
  price: number;
  description: string | null;
  items_to_bring: string | null;
  precautions: string | null;
  member_only: number | boolean;
  public_visible: number | boolean;
  member_visible: number | boolean;
  registration_enabled: number | boolean;
  waitlist_enabled: number | boolean;
};

const jstInput = (value?: string) =>
  value
    ? new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    : '';
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
async function resultOf(response: Response) {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error ||
        (data.errors
          ? Object.values(data.errors).join(' ')
          : '保存できませんでした'),
    );
  return data;
}

export default function EventAdmin({
  events,
  reload,
  canEdit,
}: {
  events: Event[];
  reload: () => Promise<void>;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('event'),
  );
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  function selectEvent(id: string | null) {
    setSelected(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('event', id);
    else url.searchParams.delete('event');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  const current = events.find((event) => event.id === selected);
  const rows = events.filter((event) =>
    `${event.title} ${event.venue}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <KaihipayManagementLinks />
      <div className="admin-section-actions">
        <span>{events.length}件</span>
        {canEdit && (
          <button
            className="admin-primary"
            onClick={() => {
              selectEvent('new');
              setMessage('');
            }}
          >
            ＋ 新規作成
          </button>
        )}
      </div>
      {message && (
        <p className="state-banner" role="status">
          {message}
        </p>
      )}
      {canEdit && (selected === 'new' || current) && (
        <EventEditor
          key={selected}
          event={current}
          close={() => selectEvent(null)}
          saved={async (id, text) => {
            await reload();
            selectEvent(id);
            setMessage(text);
          }}
          removed={async () => {
            selectEvent(null);
            await reload();
            setMessage('イベントを削除しました');
          }}
        />
      )}
      <div className="toolbar">
        <input
          aria-label="イベント検索"
          placeholder="イベント名・会場で検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <section className="panel table-panel">
        <table>
          <thead>
            <tr>
              {[
                'イベント',
                '日程 / 会場',
                '申込',
                '参加費',
                '公開状態',
                '操作',
              ].map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((event) => (
              <tr key={event.id}>
                <td>
                  <b>{event.title}</b>
                  <small>{event.slug}</small>
                </td>
                <td>
                  {dateLabel(event.start_at)}
                  <small>{event.venue}</small>
                </td>
                <td>
                  {event.applications} / {event.capacity}
                </td>
                <td>{event.price.toLocaleString('ja-JP')}円</td>
                <td>
                  <span
                    className={
                      'badge ' +
                      (event.status === 'published' ? 'active' : 'neutral')
                    }
                  >
                    {event.status === 'published' ? '公開中' : '下書き'}
                  </span>
                </td>
                <td>
                  {canEdit ? (
                    <button
                      className="small-button"
                      onClick={() => {
                        selectEvent(event.id);
                        setMessage('');
                      }}
                    >
                      編集・公開
                    </button>
                  ) : (
                    <span>閲覧のみ</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="empty-copy">イベントはありません</p>}
      </section>
    </>
  );
}

function EventEditor({
  event,
  saved,
  removed,
  close,
}: {
  event?: Event;
  saved: (id: string, message: string) => Promise<void>;
  removed: () => Promise<void>;
  close: () => void;
}) {
  const [status, setStatus] = useState(event?.status || 'draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function submit(form: HTMLFormElement, action: string) {
    setBusy(true);
    setError('');
    try {
      const data = new FormData(form);
      const nextStatus = action === 'save' ? status : action;
      const payload = {
        ...Object.fromEntries(data),
        start_at: new Date(`${data.get('start_at')}:00+09:00`).toISOString(),
        end_at: new Date(`${data.get('end_at')}:00+09:00`).toISOString(),
        capacity: Number(data.get('capacity')),
        price: Number(data.get('price')),
        event_type: data.get('event_type') || 'salon',
        publish_status: nextStatus,
        member_only: data.has('member_only'),
        member_visible: data.has('member_visible'),
        public_visible: data.has('public_visible'),
        registration_enabled: data.has('registration_enabled'),
        waitlist_enabled: data.has('waitlist_enabled'),
      };
      const result = await resultOf(
        await fetch(
          '/api/admin/entity/events' + (event ? '/' + event.id : ''),
          {
            method: event ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        ),
      );
      setStatus(nextStatus);
      await saved(
        event?.id || result.id,
        action === 'save'
          ? '変更を保存しました'
          : nextStatus === 'published'
            ? 'イベントを公開しました'
            : '下書きとして保存しました',
      );
    } catch (exception) {
      setError(
        (exception instanceof Error
          ? exception.message
          : '保存できませんでした') + ' 入力内容はこの画面に保持しています',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="panel event-editor"
      aria-label={event ? 'イベントの編集' : 'イベントの新規作成'}
      onSubmit={(submission) => {
        submission.preventDefault();
        const action = (submission.nativeEvent as SubmitEvent)
          .submitter as HTMLButtonElement | null;
        void submit(submission.currentTarget, action?.value || 'save');
      }}
    >
      <header className="event-editor-heading">
        <h2>{event ? 'イベントの編集' : 'イベントの新規作成'}</h2>
        <span className="badge">
          {status === 'published' ? '公開中' : '下書き'}
        </span>
        <button type="button" disabled={busy} onClick={close}>
          閉じる
        </button>
      </header>
      <fieldset disabled={busy} className="event-editor-fields">
        <label>
          イベント名
          <input
            name="title"
            defaultValue={event?.title}
            required
            maxLength={200}
          />
        </label>
        <label>
          URL名
          <input
            aria-label="URL名"
            name="slug"
            defaultValue={event?.slug}
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="wine-meeting-2026"
          />
          <small>英小文字・数字・ハイフン</small>
        </label>
        <label>
          開始日時（日本時間）
          <input
            name="start_at"
            type="datetime-local"
            defaultValue={jstInput(event?.start_at)}
            required
          />
        </label>
        <label>
          終了日時（日本時間）
          <input
            name="end_at"
            type="datetime-local"
            defaultValue={jstInput(event?.end_at)}
            required
          />
        </label>
        <label>
          会場
          <input
            name="venue"
            defaultValue={event?.venue}
            required
            maxLength={300}
          />
        </label>
        <label>
          イベント種別
          <input
            name="event_type"
            defaultValue={event?.event_type || 'NOMIKAI'}
          />
        </label>
        <label>
          定員
          <input
            name="capacity"
            type="number"
            min="1"
            step="1"
            defaultValue={event?.capacity || 6}
            required
          />
        </label>
        <label>
          参加費（円）
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            defaultValue={event?.price ?? 0}
            required
          />
        </label>
        <label className="event-editor-wide">
          説明
          <textarea
            name="description"
            defaultValue={event?.description || ''}
            rows={5}
          />
        </label>
        <label>
          持ち物
          <textarea
            name="items_to_bring"
            defaultValue={event?.items_to_bring || ''}
            rows={2}
          />
        </label>
        <label>
          注意事項
          <textarea
            name="precautions"
            defaultValue={event?.precautions || ''}
            rows={2}
          />
        </label>
        <div className="event-editor-options event-editor-wide">
          <label>
            <input
              name="member_only"
              type="checkbox"
              defaultChecked={event ? Boolean(event.member_only) : true}
            />
            会員限定
          </label>
          <label>
            <input
              name="member_visible"
              type="checkbox"
              defaultChecked={event ? Boolean(event.member_visible) : true}
            />
            会員サイトに掲載
          </label>
          <label>
            <input
              name="public_visible"
              type="checkbox"
              defaultChecked={event ? Boolean(event.public_visible) : false}
            />
            一般公開ページにも掲載
          </label>
          <label>
            <input
              name="registration_enabled"
              type="checkbox"
              defaultChecked={
                event ? Boolean(event.registration_enabled) : true
              }
            />
            申込を受け付ける
          </label>
          <label>
            <input
              name="waitlist_enabled"
              type="checkbox"
              defaultChecked={event ? Boolean(event.waitlist_enabled) : true}
            />
            満席時にキャンセル待ちを受け付ける
          </label>
        </div>
      </fieldset>
      <div className="event-editor-actions">
        <button
          className="admin-primary"
          type="submit"
          value={event ? 'save' : 'draft'}
          disabled={busy}
        >
          {busy ? '保存中…' : event ? '変更を保存' : '下書き保存'}
        </button>
        {status !== 'published' ? (
          <button
            type="submit"
            className="admin-primary"
            value="published"
            disabled={busy}
          >
            公開する
          </button>
        ) : (
          <button type="submit" value="draft" disabled={busy}>
            非公開にして保存
          </button>
        )}
        {event &&
          status === 'published' &&
          Boolean(event.public_visible || event.member_visible) && (
            <a
              href={'/events/' + event.slug}
              target="_blank"
              rel="noopener noreferrer"
            >
              {event.public_visible ? '公開ページを確認' : '会員向け表示を確認'}{' '}
              ↗
            </a>
          )}
        {event && (
          <button
            className="event-editor-delete"
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            削除する
          </button>
        )}
      </div>
      {confirmDelete && (
        <div className="event-delete-confirm" role="alert">
          <p>
            このイベントを削除しますか　サイトから非表示になります　申込の記録は保持されます
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await resultOf(
                  await fetch('/api/admin/entity/events/' + event!.id, {
                    method: 'DELETE',
                  }),
                );
                await removed();
              } catch (exception) {
                setError(
                  exception instanceof Error
                    ? exception.message
                    : '削除できませんでした',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            削除を確定する
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            キャンセル
          </button>
        </div>
      )}
      {error && (
        <p className="state-banner error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
