import { useCallback, useEffect, useState } from "react";
import {
  BAD_AUTHOR,
  CHAIN_ID,
  Post,
  createPost,
  deleteAllPosts,
  deletePost,
  fetchLiked,
  fetchOwner,
  fetchPosts,
  likePost,
  subscribeToChanges,
  unlikePost,
} from "./contract";
import { errorMessage, getAccounts, getChainId, requestAccounts, switchToLocalNetwork } from "./wallet";

function formatDate(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toLocaleString("ru-RU");
}

function sameAddress(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasWallet = window.ethereum !== undefined;
  const wrongNetwork = account !== null && chainId !== CHAIN_ID;
  const canWrite = account !== null && !wrongNetwork && !busy;
  const isOwner = sameAddress(account, owner);

  const loadPosts = useCallback(async () => {
    try {
      const list = await fetchPosts(filter);
      setPosts(list);
      setLiked(await fetchLiked(list, account));
      setOwner(await fetchOwner());
      setError("");
    } catch (err) {
      setError(
        err instanceof Error && err.message === BAD_AUTHOR
          ? BAD_AUTHOR
          : "Не удалось прочитать посты. Проверьте, запущена ли нода и выполнен ли деплой",
      );
    }
  }, [filter, account]);

  useEffect(() => {
    loadPosts();
    return subscribeToChanges(loadPosts);
  }, [loadPosts]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) {
      return;
    }
    getAccounts().then((accounts) => setAccount(accounts[0] ?? null));
    getChainId().then(setChainId);

    const onAccounts = (accounts: unknown) => setAccount((accounts as string[])[0] ?? null);
    const onChain = (id: unknown) => setChainId(parseInt(id as string, 16));
    ethereum.on("accountsChanged", onAccounts);
    ethereum.on("chainChanged", onChain);
    return () => {
      ethereum.removeListener("accountsChanged", onAccounts);
      ethereum.removeListener("chainChanged", onChain);
    };
  }, []);

  async function connect() {
    setError("");
    try {
      const accounts = await requestAccounts();
      setAccount(accounts[0] ?? null);
      setChainId(await getChainId());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function switchNetwork() {
    setError("");
    try {
      await switchToLocalNetwork();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await action();
      await loadPosts();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(async () => {
      await createPost(text);
      setText("");
    });
  }

  function toggleLike(post: Post) {
    const isLiked = liked[post.id.toString()] === true;
    run(() => (isLiked ? unlikePost(post.id) : likePost(post.id)));
  }

  function removePost(post: Post) {
    run(() => deletePost(post.id));
  }

  function removeAll() {
    run(() => deleteAllPosts());
  }

  function showAuthor() {
    setFilter(authorInput.trim());
  }

  function showMine() {
    if (account) {
      setAuthorInput(account);
      setFilter(account);
    }
  }

  function showAll() {
    setAuthorInput("");
    setFilter(null);
  }

  return (
    <div className="page">
      <h1>Посты</h1>

      <div className="wallet">
        {!hasWallet && <p className="error">MetaMask не найден. Установите расширение MetaMask и обновите страницу</p>}
        {hasWallet && !account && <button onClick={connect}>Подключить кошелёк</button>}
        {account && <p>Подключено: <strong>{account}</strong></p>}
        {isOwner && <p>Вы владелец контракта</p>}
        {wrongNetwork && (
          <p className="error">
            Неверная сеть (chainId {chainId}). <button onClick={switchNetwork}>Переключить на {CHAIN_ID}</button>
          </p>
        )}
      </div>

      <section className="panel">
        <h2>Новый пост</h2>
        <form onSubmit={submit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Текст поста"
          />
          <button type="submit" disabled={!canWrite}>
            {busy ? "Ожидание..." : "Опубликовать"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Фильтр по автору</h2>
        <div className="filter">
          <input
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            placeholder="Адрес автора 0x..."
          />
          <button onClick={showAuthor} disabled={authorInput.trim() === ""}>Показать посты автора</button>
          <button onClick={showMine} disabled={!account}>Мои посты</button>
          <button onClick={showAll}>Все посты</button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="feed-header">
        <h2>{filter === null ? "Все посты" : "Посты автора " + filter}</h2>
        {isOwner && (
          <button className="danger" onClick={removeAll} disabled={!canWrite}>Удалить все посты</button>
        )}
      </div>

      <div className="feed">
        {posts.map((p) => {
          const isLiked = liked[p.id.toString()] === true;
          return (
            <article className="card" key={p.id.toString()}>
              <div className="card-meta">
                <span className="address">{p.author}</span>
                <span>{formatDate(p.createdAt)}</span>
              </div>
              <p className="card-text">{p.text}</p>
              <div className="card-actions">
                <button className={isLiked ? "like liked" : "like"} onClick={() => toggleLike(p)} disabled={!canWrite}>
                  {isLiked ? "♥ Убрать лайк" : "♡ Лайкнуть"}
                </button>
                <span className="likes">Лайков: {p.likes.toString()}</span>
                {sameAddress(account, p.author) && (
                  <button className="danger" onClick={() => removePost(p)} disabled={!canWrite}>Удалить</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {posts.length === 0 && <p>Постов пока нет</p>}
    </div>
  );
}
