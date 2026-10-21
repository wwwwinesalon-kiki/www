'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { articleHtml, cleanArticle, PRIMARY_CATEGORIES } from '@/lib/article';

type Article = {
  id: string;
  title: string;
  summary?: string;
  type: string;
  body: string;
  body_format?: string;
  cover_image: string | null;
  cover_alt?: string;
  publish_status: string;
  updated_at: string;
  public_visible: boolean;
  deleted_at?: string;
  archived_at?: string;
};
type Media = { id: string; alt: string };
export default function ArticleAdmin({
  id,
  canEdit,
}: {
  id?: string;
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<Article[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [publishStatus, setPublishStatus] = useState('all');
  useEffect(() => {
    let live = true;
    fetch('/api/admin/entity/contents', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('記事を読み込めませんでした');
        return r.json();
      })
      .then((data) => {
        if (live) setRows(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const selected = rows?.find((c) => c.id === id);
  const availableRows = (rows || []).filter(
    (c) =>
      !c.deleted_at &&
      !c.archived_at &&
      (canEdit || c.publish_status === 'published'),
  );
  const filteredRows = availableRows.filter((c) => {
    const matchesText = `${c.title} ${c.summary || ''} ${c.type}`
      .toLocaleLowerCase('ja-JP')
      .includes(query.trim().toLocaleLowerCase('ja-JP'));
    return (
      matchesText &&
      (category === 'all' || c.type === category) &&
      (publishStatus === 'all' || c.publish_status === publishStatus)
    );
  });
  const categories = Array.from(
    new Set(availableRows.map((c) => c.type)),
  ).sort();
  return (
    <main className="article-shell admin-article-shell">
      <h1 className="admin-visually-hidden">記事管理</h1>
      <header className="admin-article-header">
        <Link
          className="admin-article-brand"
          href="/admin"
          aria-label="WWW 記事管理"
        >
          WWW
        </Link>
        <nav aria-label="管理メニュー">
          <Link href="/admin" aria-current={!id ? 'page' : undefined}>
            記事
          </Link>
          <Link href="/admin/events">イベント</Link>
          <Link href="/admin/applications">申込</Link>
          <Link href="/admin/kaihipay">会費ペイ</Link>
        </nav>
        <div className="admin-article-utility">
          <Link href="/member" target="_blank" rel="noopener noreferrer">
            会員サイト ↗
          </Link>
          <form action="/api/member/logout" method="post">
            <button type="submit">ログアウト</button>
          </form>
        </div>
      </header>
      <div className="admin-article-content">
        {error && (
          <p role="alert" className="admin-article-feedback">
            {error}{' '}
            <button onClick={() => location.reload()}>再読み込み</button>
          </p>
        )}
        {!rows && !error && <output>読み込み中…</output>}
        {rows && !id && (
          <section aria-label="記事一覧">
            <div className="admin-article-listbar">
              <span className="admin-article-count">
                記事 {availableRows.length}件
              </span>
              {canEdit && (
                <Link
                  className="admin-article-primary"
                  href="/admin/contents/new"
                >
                  ＋ 新規作成
                </Link>
              )}
            </div>
            <div className="admin-article-filters">
              <input
                type="search"
                aria-label="記事を検索"
                placeholder="記事を検索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                aria-label="カテゴリで絞り込み"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">全カテゴリ</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              {canEdit && (
                <select
                  aria-label="公開状態で絞り込み"
                  value={publishStatus}
                  onChange={(event) => setPublishStatus(event.target.value)}
                >
                  <option value="all">全状態</option>
                  <option value="published">公開中</option>
                  <option value="draft">下書き</option>
                </select>
              )}
            </div>
            <ul className="admin-article-list">
              {filteredRows.map((c) => (
                <li className="admin-article-item" key={c.id}>
                  <div className="admin-article-item-main">
                    <strong>{c.title || '無題の記事'}</strong>
                    <span>
                      {c.type}
                      {c.public_visible ? ' · 一般公開' : ''}
                    </span>
                  </div>
                  <span
                    className={`admin-article-status ${c.publish_status === 'published' ? 'is-published' : ''}`}
                  >
                    {c.publish_status === 'published' ? '公開中' : '下書き'}
                  </span>
                  <time dateTime={c.updated_at}>
                    {c.updated_at?.slice(0, 10) || '—'}
                  </time>
                  {canEdit && (
                    <Link
                      className="admin-article-edit-link"
                      href={'/admin/contents/' + c.id}
                    >
                      編集 <span aria-hidden>→</span>
                    </Link>
                  )}
                </li>
              ))}
              {filteredRows.length === 0 && (
                <li className="admin-article-empty">
                  {availableRows.length === 0
                    ? '記事はまだありません'
                    : '該当する記事がありません'}
                </li>
              )}
            </ul>
          </section>
        )}
        {rows && id && canEdit && (id === 'new' || selected) && (
          <ArticleEditor
            key={id}
            initial={selected}
            categories={Array.from(
              new Set([...PRIMARY_CATEGORIES, ...rows.map((r) => r.type)]),
            )}
          />
        )}
        {rows && id && !canEdit && <p role="alert">編集権限がありません</p>}
        {rows && id && id !== 'new' && !selected && <p>記事が見つかりません</p>}
      </div>
    </main>
  );
}

function ArticleEditor({
  initial,
  categories,
}: {
  initial?: Article;
  categories: string[];
}) {
  const [id] = useState(() => initial?.id || crypto.randomUUID());
  const [saved, setSaved] = useState(!!initial);
  const [version, setVersion] = useState(initial?.updated_at);
  const [title, setTitle] = useState(initial?.title || '');
  const [summary, setSummary] = useState(initial?.summary || '');
  const [type, setType] = useState(initial?.type || 'TABLE');
  const [cover, setCover] = useState(initial?.cover_image || '');
  const [coverAlt, setCoverAlt] = useState(initial?.cover_alt || '');
  const [status, setStatus] = useState(initial?.publish_status || 'draft');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const editor = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [media, setMedia] = useState<Media[]>([]);
  const [alt, setAlt] = useState('');
  const [target, setTarget] = useState('cover');
  const mark = () => {
    dirtyRef.current = true;
    setDirty(true);
  };
  useLayoutEffect(() => {
    if (editor.current)
      editor.current.innerHTML = articleHtml(
        initial?.body || '',
        initial?.body_format,
      );
  }, [initial]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    const navigate = (e: MouseEvent) => {
      const a = (e.target as Element).closest('a');
      if (
        a &&
        a.target !== '_blank' &&
        dirtyRef.current &&
        !window.confirm('未保存の原稿があります この画面を離れますか')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [initial]);
  async function loadMedia() {
    try {
      const r = await fetch('/api/admin/media?article=' + id, {
        cache: 'no-store',
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMedia(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像一覧を取得できません');
    }
  }
  function command(cmd: string, value?: string) {
    editor.current?.focus();
    document.execCommand(cmd, false, value);
    mark();
  }
  function chooseImage(item: Media) {
    const url = '/api/media/' + item.id;
    if (target === 'cover') {
      setCover(url);
      setCoverAlt(item.alt);
      mark();
    } else {
      editor.current?.focus();
      const range = document.createRange();
      range.selectNodeContents(editor.current!);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const image = document.createElement('img');
      image.src = url;
      image.alt = item.alt;
      command('insertHTML', image.outerHTML);
    }
  }
  async function save(nextStatus: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = cleanArticle(editor.current?.innerHTML || '');
      const r = await fetch(
        '/api/admin/entity/contents' + (saved ? '/' + id : ''),
        {
          method: saved ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            title,
            summary,
            type,
            body,
            cover_image: cover || null,
            cover_alt: coverAlt,
            publish_status: nextStatus,
            updated_at: version,
          }),
        },
      );
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || '保存に失敗しました');
      setSaved(true);
      setVersion(result.updated_at);
      setStatus(nextStatus);
      dirtyRef.current = false;
      setDirty(false);
      setMessage(
        nextStatus === 'published'
          ? '公開しました'
          : '下書きとして保存しました',
      );
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : '保存できませんでした') +
          ' 原稿はこの画面に保持しています',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-article-workspace">
      <h2 className="admin-visually-hidden">
        {initial ? '記事の編集' : '新しい記事'}
      </h2>
      <div className="admin-article-editor-head">
        <Link href="/admin" className="admin-article-back">
          ← 記事一覧
        </Link>
        <span
          className={`admin-article-status ${status === 'published' ? 'is-published' : ''}`}
        >
          {status === 'published' ? '公開中' : '下書き'}
        </span>
        {dirty && <span className="admin-article-dirty">未保存</span>}
      </div>
      {initial?.public_visible && (
        <p className="article-notice">
          一般公開記事 · 公開範囲は変更されません
        </p>
      )}
      <fieldset disabled={busy} className="admin-article-fieldset">
        {!initial && (
          <div className="admin-article-templates">
            <h2>テンプレート</h2>
            <div className="article-template-actions">
              {(
                [
                  [
                    'FIELD',
                    '畑の記録',
                    '<h2>今日の畑</h2><p>訪れた場所と日付</p><h2>作り手の声</h2><p>現地で聞いたこと</p><h2>音声・関連情報</h2><p>共有したいリンク</p>',
                  ],
                  [
                    'TABLE',
                    '日々の発行レシピ研究',
                    '<h2>今日の一皿</h2><p>料理と季節のこと</p><h2>材料と作り方</h2><p>ここに記入</p><h2>ワインとの組み合わせ</h2><p>ここに記入</p>',
                  ],
                  [
                    'PEOPLE',
                    '作り手の話',
                    '<h2>この人について</h2><p>紹介文</p><h2>10分インタビュー</h2><p>会話や音声へのリンク</p><h2>関連するワインと畑</h2><p>ここに記入</p>',
                  ],
                  ['NEWS', 'お知らせ', '<h2>お知らせ</h2><p>内容を記入</p>'],
                ] as const
              ).map(([category, label, body]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (dirty && !confirm('入力中の本文を置き換えますか'))
                      return;
                    setType(category);
                    if (editor.current) editor.current.innerHTML = body;
                    mark();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label htmlFor="article-title">タイトル</label>
        <input
          id="article-title"
          placeholder="記事のタイトル"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            mark();
          }}
          maxLength={200}
        />
        <label htmlFor="article-category">カテゴリ</label>
        <select
          id="article-category"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            mark();
          }}
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label htmlFor="article-summary">概要</label>
        <textarea
          id="article-summary"
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            mark();
          }}
          maxLength={300}
          rows={3}
          placeholder="記事の内容を2行ほどで紹介"
        />
        <p className="admin-article-field-label">メイン画像</p>
        {cover ? (
          <>
            <Image
              unoptimized
              width={1200}
              height={800}
              className="article-cover"
              src={cover}
              alt={coverAlt}
            />
            <button
              type="button"
              onClick={() => {
                setCover('');
                setCoverAlt('');
                mark();
              }}
            >
              メイン画像を外す
            </button>
          </>
        ) : (
          <p>画像は未設定です</p>
        )}
        <label htmlFor="cover-alt">画像の説明</label>
        <input
          id="cover-alt"
          value={coverAlt}
          onChange={(e) => {
            setCoverAlt(e.target.value);
            mark();
          }}
          maxLength={500}
        />
        <details className="admin-article-media">
          <summary>画像を追加・差し替え</summary>
          <small>JPEG / PNG / WebP · 最大3MB</small>
          <label htmlFor="image-target">画像を入れる場所</label>
          <select
            id="image-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="cover">メイン画像</option>
            <option value="body">本文の末尾</option>
          </select>
          <label htmlFor="image-alt">アップロード画像の説明</label>
          <input
            id="image-alt"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={500}
          />
          <label htmlFor="image-file">画像ファイル</label>
          <input
            id="image-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError('');
              try {
                const form = new FormData();
                form.set('file', file);
                form.set('article_id', id);
                form.set('alt', alt);
                const r = await fetch('/api/admin/media', {
                  method: 'POST',
                  body: form,
                });
                const result = await r.json();
                if (!r.ok) throw new Error(result.error);
                chooseImage(result);
                setMedia((prev) => [result, ...prev]);
                setMessage('画像を保存しました 記事も保存してください');
              } catch (ex) {
                setError(
                  ex instanceof Error
                    ? ex.message
                    : '画像を保存できませんでした',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <button type="button" onClick={loadMedia}>
            保存済み画像を選ぶ
          </button>
          <div className="media-list">
            {media.map((m) => (
              <button key={m.id} type="button" onClick={() => chooseImage(m)}>
                <Image
                  unoptimized
                  width={120}
                  height={90}
                  src={'/api/media/' + m.id}
                  alt={m.alt}
                />
                {m.alt}
              </button>
            ))}
          </div>
        </details>
      </fieldset>
      <p id="body-label">本文</p>
      <div className="editor-toolbar" role="toolbar" aria-label="本文の書式">
        {(
          [
            ['段落', 'formatBlock', 'p'],
            ['大見出し', 'formatBlock', 'h2'],
            ['小見出し', 'formatBlock', 'h3'],
            ['太字', 'bold', ''],
            ['箇条書き', 'insertUnorderedList', ''],
            ['番号付き', 'insertOrderedList', ''],
          ] as const
        ).map(([label, cmd, value]) => (
          <button
            disabled={busy}
            key={label}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(cmd, value)}
          >
            {label}
          </button>
        ))}
        <button
          disabled={busy}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = prompt('リンク先のURL（https://）');
            if (url && url.startsWith('https://')) {
              command('createLink', url);
            } else if (url) {
              setError('https:// で始まるリンクを入力してください');
            }
          }}
        >
          リンク
        </button>
      </div>
      <div
        ref={editor}
        className="article-editor"
        contentEditable={!busy}
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-labelledby="body-label"
        onInput={mark}
        onDrop={(e) => e.preventDefault()}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData('text/html');
          const text = e.clipboardData.getData('text/plain');
          command(
            'insertHTML',
            html ? cleanArticle(html) : articleHtml(text, 'plain'),
          );
        }}
      />
      <div className="article-actions">
        <button disabled={busy} onClick={() => save('draft')}>
          {status === 'published' ? '公開を取り下げて保存' : '下書き保存'}
        </button>
        {saved && !dirty && (
          <a
            href={'/admin/preview/' + id}
            target="_blank"
            rel="noopener noreferrer"
          >
            プレビュー
          </a>
        )}
        <button
          disabled={busy}
          onClick={() => {
            if (confirm('この記事を公開しますか')) void save('published');
          }}
        >
          公開する
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
