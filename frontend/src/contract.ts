import { BrowserProvider, Contract, JsonRpcProvider, Network, isAddress } from "ethers";
import deployment from "./contract.json";

export const RPC_URL = "http://127.0.0.1:8545";
export const CHAIN_ID = 31337;
export const BAD_AUTHOR = "Неверный адрес автора";

export interface Post {
  id: bigint;
  author: string;
  text: string;
  createdAt: bigint;
  likes: bigint;
}

const provider = new JsonRpcProvider(RPC_URL, Network.from(CHAIN_ID), { staticNetwork: true });
provider.pollingInterval = 1000;

const reader = new Contract(deployment.address, deployment.abi, provider);

function toPosts(list: Post[]): Post[] {
  return list
    .map((p) => ({ id: p.id, author: p.author, text: p.text, createdAt: p.createdAt, likes: p.likes }))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

export async function fetchPosts(author: string | null): Promise<Post[]> {
  if (author !== null && !isAddress(author)) {
    throw new Error(BAD_AUTHOR);
  }
  const list = author === null ? await reader.getPosts() : await reader.getPostsByAuthor(author);
  return toPosts(list);
}

export async function fetchOwner(): Promise<string> {
  return await reader.owner();
}

export async function fetchLiked(posts: Post[], account: string | null): Promise<Record<string, boolean>> {
  if (account === null) {
    return {};
  }
  const flags: boolean[] = await Promise.all(posts.map((p) => reader.hasLiked(p.id, account)));
  const result: Record<string, boolean> = {};
  posts.forEach((p, i) => {
    result[p.id.toString()] = flags[i];
  });
  return result;
}

export function subscribeToChanges(onChange: () => void): () => void {
  const filter = { address: deployment.address };
  provider.on(filter, onChange);
  return () => {
    provider.off(filter, onChange);
  };
}

async function writer(): Promise<Contract> {
  if (!window.ethereum) {
    throw new Error("MetaMask не установлен");
  }
  const browserProvider = new BrowserProvider(window.ethereum);
  const signer = await browserProvider.getSigner();
  return new Contract(deployment.address, deployment.abi, signer);
}

export async function createPost(text: string): Promise<void> {
  const tx = await (await writer()).createPost(text);
  await tx.wait();
}

export async function deletePost(id: bigint): Promise<void> {
  const tx = await (await writer()).deletePost(id);
  await tx.wait();
}

export async function deleteAllPosts(): Promise<void> {
  const tx = await (await writer()).deleteAllPosts();
  await tx.wait();
}

export async function likePost(id: bigint): Promise<void> {
  const tx = await (await writer()).likePost(id);
  await tx.wait();
}

export async function unlikePost(id: bigint): Promise<void> {
  const tx = await (await writer()).unlikePost(id);
  await tx.wait();
}
