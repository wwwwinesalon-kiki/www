'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { articleHtml, cleanArticle, PRIMARY_CATEGORIES } from '@/lib/article';
import { articleToMarkdown, markdownToArticle } from '@/lib/article-markdown';
import { imageToWebp } from '@/lib/image-webp-client';
import '@/app/article-editor-refresh.css';

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
  }, [id]);
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
            onSaved={(article) => setRows(previous => [article, ...(previous || []).filter(row => row.id !== article.id)])}
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
  onSaved,
}: {
  initial?: Article;
  categories: string[];
  onSaved: (article: Article) => void;
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
  const editorInitialized = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [media, setMedia] = useState<Media[]>([]);
  const [alt, setAlt] = useState('');
  const [target, setTarget] = useState('cover');
  const [mode, setMode] = useState<'visual' | 'markdown' | 'preview'>('visual');
  const [markdown, setMarkdown] = useState('');
  const [preview, setPreview] = useState('');
  const [mediaRevision, setMediaRevision] = useState(0);
  const [uploadProgress, setUploadProgress] = useState('');
  const mark = () => {
    dirtyRef.current = true;
    setDirty(true);
  };
  useLayoutEffect(() => {
    // The component is keyed by article ID. A list refresh or save callback may
    // replace metadata, but must never overwrite a new edit already in progress.
    if (!editor.current || editorInitialized.current) return;
    editor.current.innerHTML = articleHtml(
      initial?.body || '',
      initial?.body_format,
    );
    editorInitialized.current = true;
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
  useEffect(() => { void loadMedia(); }, [id]);
  function currentHtml() {
    return mode === 'markdown' ? markdownToArticle(markdown) : cleanArticle(editor.current?.innerHTML || '');
  }
  function switchMode(next: 'visual' | 'markdown' | 'preview') {
    const html = currentHtml();
    if (next === 'markdown') setMarkdown(articleToMarkdown(html));
    if (next === 'preview') setPreview(html);
    if (editor.current) editor.current.innerHTML = html;
    setMode(next);
  }
  function reviseImage(item: Media, remove = false) {
    const url = '/api/media/' + item.id;
    const documentBody = document.createElement('div');
    documentBody.innerHTML = currentHtml();
    documentBody.querySelectorAll('img').forEach(image => {
      if (image.getAttribute('src') !== url) return;
      if (remove) image.remove();
      else image.alt = item.alt;
    });
    const html = cleanArticle(documentBody.innerHTML);
    if (editor.current) editor.current.innerHTML = html;
    if (mode === 'markdown') setMarkdown(articleToMarkdown(html));
    if (mode === 'preview') setPreview(html);
    if (cover === url) {
      setCover(remove ? '' : url);
      setCoverAlt(remove ? '' : item.alt);
    }
    mark();
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
      if (mode === 'markdown') {
        const image = document.createElement('img');
        image.src = url;
        image.alt = item.alt;
        setMarkdown(prev => `${prev}\n\n${articleToMarkdown(image.outerHTML)}\n`);
        mark();
        return;
      }
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
      editor.current?.appendChild(image);
      if (mode === 'preview') setPreview(cleanArticle(editor.current?.innerHTML || ''));
      mark();
    }
  }
  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setError('');
    setMessage('');
    const uploaded: Media[] = [];
    try {
      for (let index = 0; index < files.length; index++) {
        setUploadProgress(`画像を登録中 ${index + 1} / ${files.length}`);
        const file = await imageToWebp(files[index]);
        const form = new FormData();
        form.set('file', file);
        form.set('article_id', id);
        form.set('alt', alt.trim() || files[index].name.replace(/\.[^.]+$/, ''));
        const r = await fetch('/api/admin/media', { method: 'POST', body: form });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || '画像を登録できませんでした');
        uploaded.push(result);
        setMedia(prev => [result, ...prev]);
        // Multiple uploads form a library; they never overwrite each other.
        if (target === 'body' || (files.length === 1 && target === 'cover')) chooseImage(result);
      }
      setMessage(`${uploaded.length === 1 ? '画像を保存しました' : `${uploaded.length}枚の画像を保存しました`}${files.length > 1 && target === 'cover' ? ' メイン画像に使う写真を選んでください' : ' 記事も保存してください'}`);
    } catch (ex) {
      setError(`${ex instanceof Error ? ex.message : '画像を登録できませんでした'}${uploaded.length ? ` ${uploaded.length}枚は登録済みです` : ''}`);
    } finally {
      setUploadProgress('');
      setBusy(false);
    }
  }
  async function updateImage(item: Media, file?: File) {
    const description = file ? item.alt : prompt('画像の説明', item.alt);
    if (description === null) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('article_id', id);
      form.set('alt', description || '');
      if (file) form.set('file', await imageToWebp(file));
      const r = await fetch('/api/admin/media/' + item.id, { method: 'PATCH', body: form });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || '画像を変更できませんでした');
      setMedia(prev => prev.map(m => m.id === item.id ? result : m));
      reviseImage(result);
      setMediaRevision(Date.now());
      mark();
      setMessage('画像を変更しました 記事も保存してください');
    } catch (ex) { setError(ex instanceof Error ? ex.message : '画像を変更できませんでした'); }
    finally { setBusy(false); }
  }
  async function deleteImage(item: Media) {
    if (!confirm('この画像を削除しますか 記事で使用中の場合は先に画像を外して保存してください')) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/media/' + item.id, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ article_id: id }) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || '画像を削除できませんでした');
      setMedia(prev => prev.filter(m => m.id !== item.id));
      reviseImage(item, true);
      setMessage('画像を削除しました');
    } catch (ex) { setError(ex instanceof Error ? ex.message : '画像を削除できませんでした'); }
    finally { setBusy(false); }
  }
  async function save(nextStatus: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = currentHtml();
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
      onSaved({
        ...initial,
        id,
        title: title.trim() || '無題の記事',
        summary,
        type,
        body,
        body_format: 'html',
        cover_image: cover || null,
        cover_alt: coverAlt,
        publish_status: nextStatus,
        updated_at: result.updated_at,
        public_visible: initial?.public_visible || false,
      });
      if (!saved) window.history.replaceState(null, '', '/admin/contents/' + id);
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
        {saved && !dirty && <span className="article-saved-badge">保存済み</span>}
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
                    if (mode === 'markdown') setMarkdown(articleToMarkdown(body));
                    if (mode === 'preview') setPreview(body);
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
          <small>複数枚を選択できます · 自動でWebPに変換 · 元画像は1枚25MBまで</small>
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
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = '';
              await uploadFiles(files);
            }}
          />
          {uploadProgress && <p role="status">{uploadProgress}</p>}
          <button type="button" onClick={loadMedia}>
            保存済み画像を選ぶ
          </button>
          <div className="media-list article-media-grid">
            {media.map((m) => (
              <div key={m.id} className="article-media-card">
                <Image
                  unoptimized
                  width={120}
                  height={90}
                  src={'/api/media/' + m.id + (mediaRevision ? '?v=' + mediaRevision : '')}
                  alt={m.alt}
                />
                <span>{m.alt || '画像'}</span>
                <div className="article-media-card-actions">
                  <button type="button" onClick={() => chooseImage(m)}>挿入</button>
                  <button type="button" onClick={() => void updateImage(m)}>説明</button>
                  <label className="article-media-replace">差し替え<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${m.alt || '画像'}を差し替え`} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void updateImage(m, file); }} /></label>
                  <button type="button" onClick={() => {
                    reviseImage(m, true);
                    setMessage('記事から画像を外しました 記事を保存すると削除できます');
                  }}>記事から外す</button>
                  <button type="button" onClick={() => void deleteImage(m)}>削除</button>
                </div>
              </div>
            ))}
          </div>
        </details>
      </fieldset>
      <p id="body-label">本文</p>
      <div className="article-editor-tabs" role="tablist" aria-label="本文の入力方法">
        {([['visual', 'ビジュアル'], ['markdown', 'Markdown'], ['preview', 'プレビュー']] as const).map(([value, label]) => <button key={value} id={`article-tab-${value}`} role="tab" aria-selected={mode === value} aria-controls={`article-panel-${value}`} disabled={busy} type="button" onClick={() => switchMode(value)}>{label}</button>)}
      </div>
      <div className="editor-toolbar" role="toolbar" aria-label="本文の書式" hidden={mode !== 'visual'}>
        {(
          [
            ['本文', 'formatBlock', 'p'],
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
        id="article-panel-visual"
        hidden={mode !== 'visual'}
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
            html ? cleanArticle(html) : markdownToArticle(text),
          );
        }}
      />
      {mode === 'markdown' && <section id="article-panel-markdown" role="tabpanel" aria-labelledby="article-tab-markdown" className="article-markdown-panel">
        <label className="article-markdown-upload">Markdownファイルを読み込む<input type="file" accept=".md,.markdown,text/markdown,text/plain" disabled={busy} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          if (file.size > 400_000) { setError('Markdownファイルは400KB以内にしてください'); return; }
          if (dirty && !confirm('本文をMarkdownファイルの内容に置き換えますか')) return;
          setMarkdown(await file.text()); mark();
        }} /></label>
        <textarea aria-label="Markdown本文" spellCheck={false} rows={20} disabled={busy} value={markdown} onChange={event => { setMarkdown(event.target.value); mark(); }} placeholder={'## 大見出し\n\n本文を書きます\n\n**太字**\n\n- 箇条書き'} />
        <p className="article-editor-hint">## 見出し · **太字** · - 箇条書き · 空行で段落分け</p>
      </section>}
      {mode === 'preview' && <div id="article-panel-preview" role="tabpanel" aria-labelledby="article-tab-preview" className="article-body article-editor-preview" dangerouslySetInnerHTML={{ __html: preview }} />}
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
      {error && <p role="alert" className="article-save-feedback">{error}</p>}
      {message && <p role="status" className="article-save-feedback">{message}</p>}
    </section>
  );
}
