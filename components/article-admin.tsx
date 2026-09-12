'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { articleHtml, cleanArticle, PRIMARY_CATEGORIES } from '@/lib/article';

type Article = {
  id: string;
  title: string;
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
  return (
    <main className="article-shell">
      <header>
        <p className="eyebrow">WWW / WINE WELCOME WORLD</p>
        <h1>記事管理</h1>
        <nav>
          <a href="/admin">記事一覧</a>
          <a href="/admin/events">既存イベント</a>
          <a href="/admin/applications">既存申込</a>
          <Link href="/member">会員サイト</Link>
          <a href="https://lin.ee/xWYPyBv">公式LINE</a>
        </nav>
        <form action="/api/member/logout" method="post">
          <button>ログアウト</button>
        </form>
      </header>
      {error && (
        <p role="alert">
          {error} <button onClick={() => location.reload()}>再読み込み</button>
        </p>
      )}
      {!rows && !error && <p role="status">記事を読み込んでいます</p>}
      {rows && !id && (
        <>
          <p>完成した原稿と画像を貼り付け 下書きで確認してから公開します</p>
          {canEdit && (
            <a className="button" href="/admin/contents/new">
              新しい記事
            </a>
          )}
          {!canEdit && (
            <p>閲覧用の管理アカウントです 下書きと編集は表示しません</p>
          )}
          {rows
            .filter((c) => !c.deleted_at && !c.archived_at)
            .map((c) => (
              <div className="article-row" key={c.id}>
                <div>
                  <small>
                    {c.type} ·{' '}
                    {c.publish_status === 'published' ? '公開' : '下書き'}
                    {c.public_visible ? ' · 既存の一般公開記事' : ''}
                  </small>
                  <h2>{c.title}</h2>
                </div>
                {canEdit && <a href={'/admin/contents/' + c.id}>編集する</a>}
              </div>
            ))}
          {rows.length === 0 && <p>記事はまだありません</p>}
        </>
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
      {rows && id && id !== 'new' && !selected && <p>記事が見つかりません</p>}
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
    <section>
      <h2>{initial ? '記事の編集' : '新しい記事'}</h2>
      <p>
        {status === 'published' ? '公開中' : '下書き'}
        {dirty ? ' · 未保存の変更があります' : ''}
      </p>
      {initial?.public_visible && (
        <p className="article-notice">
          既存の一般公開記事です 公開範囲は保持します
          新規の非公開画像は追加できません
        </p>
      )}
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <label htmlFor="article-title">タイトル</label>
        <input
          id="article-title"
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
        <p>メイン画像</p>
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
        <label htmlFor="cover-alt">メイン画像の説明</label>
        <input
          id="cover-alt"
          value={coverAlt}
          onChange={(e) => {
            setCoverAlt(e.target.value);
            mark();
          }}
          maxLength={500}
        />
        <div className="article-notice">
          <h3>画像の追加・差し替え</h3>
          <p>JPEG PNG WebP / 最大3MB この記事で使用する画像だけを保存します</p>
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
        </div>
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
      <p>
        見出し・太字・箇条書き・リンクを整えられます
        外部画像や埋め込みは除外されるため 画像は上から追加してください
      </p>
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
