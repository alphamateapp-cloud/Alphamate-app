import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, sendFirestoreNotification } from './firebase';
import { User } from '../types';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80';

export function mapFirestoreDocToUser(docId: string, data: Record<string, any>): User | null {
  if (!data) return null;
  if (data.accountStatus === 'permanently_deleted') return null;

  const displayName = String(data.displayName || data.name || 'Alpha Mate User').trim();
  const username = String(data.username || displayName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'alphamate').trim();
  const uniqueId = String(
    data.uniqueId ||
      `AM_${Math.abs(
        docId.split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 7)
      )
        .toString()
        .slice(0, 6)
        .padStart(6, '0')}`
  ).trim();

  return {
    id: docId,
    uniqueId,
    username,
    displayName,
    avatar: String(data.avatar || data.photoURL || DEFAULT_AVATAR),
    bio: String(data.bio || 'Alpha Mate Member'),
    email: typeof data.email === 'string' ? data.email : undefined,
    followersCount: Number(data.followersCount || 0),
    followingCount: Number(data.followingCount || 0),
    likesCount: Number(data.likesCount || 0),
    level: Math.max(1, Number(data.level || 1)),
    xp: Number(data.xp || 0),
    nextLevelXp: Math.max(100, Number(data.nextLevelXp || 500)),
    vipTier: Math.max(0, Number(data.vipTier || 0)),
    coins: Number(data.coins || 0),
    diamonds: Number(data.diamonds || 0),
    isVerified: Boolean(data.isVerified),
    familyCrew: typeof data.familyCrew === 'string' ? data.familyCrew : undefined,
    isHost: Boolean(data.isHost),
    country: typeof data.country === 'string' ? data.country : undefined,
    countryFlag: typeof data.countryFlag === 'string' ? data.countryFlag : undefined,
    activeFrame: typeof data.activeFrame === 'string' ? data.activeFrame : undefined,
    activeHonorTitle: typeof data.activeHonorTitle === 'string' ? data.activeHonorTitle : undefined,
    accountStatus: data.accountStatus || 'active',
    equippedBadgeIds: Array.isArray(data.equippedBadgeIds) ? data.equippedBadgeIds : [],
  };
}

/**
 * Subscribe to real registered Firebase users in Firestore in real time.
 */
export function subscribeToRealUsers(
  onUpdate: (users: User[]) => void,
  onError?: (err: Error) => void,
  maxUsers = 250
): () => void {
  const path = 'users';
  const q = query(collection(db, path), limit(maxUsers));
  return onSnapshot(
    q,
    (snapshot) => {
      const parsed: User[] = [];
      snapshot.forEach((docSnap) => {
        const user = mapFirestoreDocToUser(docSnap.id, docSnap.data() as Record<string, any>);
        if (user) parsed.push(user);
      });
      parsed.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onUpdate(parsed);
    },
    (err) => {
      onError?.(err);
    }
  );
}

/**
 * Fetch and filter real users across Firestore by name, @username, or AM_ unique ID.
 * Supports single-character (1+) queries seamlessly and merges with live cached users.
 */
export async function searchAllRealUsers(
  rawQuery: string,
  options?: {
    excludeUid?: string;
    cachedUsers?: User[];
    maxResults?: number;
  }
): Promise<User[]> {
  const term = rawQuery.trim().toLowerCase().replace(/^@/, '');
  const excludeUid = options?.excludeUid || auth.currentUser?.uid || '';
  const maxResults = options?.maxResults || 100;
  const cached = options?.cachedUsers || [];

  const matchesTerm = (u: User) => {
    if (!term) return true;
    return (
      u.displayName.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.uniqueId.toLowerCase().includes(term) ||
      u.id.toLowerCase().includes(term)
    );
  };

  const byId = new Map<string, User>();
  cached.forEach((u) => {
    if (u.id && u.id !== excludeUid && matchesTerm(u)) {
      byId.set(u.id, u);
    }
  });

  if (auth.currentUser?.uid) {
    try {
      const usersRef = collection(db, 'users');
      if (term.length >= 1) {
        const end = `${term}\uf8ff`;
        const prefixSnaps = await Promise.all([
          getDocs(query(usersRef, where('displayNameLower', '>=', term), where('displayNameLower', '<=', end), limit(50))).catch(() => null),
          getDocs(query(usersRef, where('usernameLower', '>=', term), where('usernameLower', '<=', end), limit(50))).catch(() => null),
          getDocs(query(usersRef, where('uniqueIdLower', '>=', term), where('uniqueIdLower', '<=', end), limit(50))).catch(() => null),
        ]);
        prefixSnaps.forEach((snap) => {
          snap?.forEach((d) => {
            if (d.id === excludeUid) return;
            const user = mapFirestoreDocToUser(d.id, d.data() as Record<string, any>);
            if (user) byId.set(user.id, user);
          });
        });
      }

      if (byId.size < maxResults) {
        const broadSnap = await getDocs(query(usersRef, limit(250))).catch(() => null);
        broadSnap?.forEach((d) => {
          if (d.id === excludeUid) return;
          const user = mapFirestoreDocToUser(d.id, d.data() as Record<string, any>);
          if (user && matchesTerm(user)) {
            byId.set(user.id, user);
          }
        });
      }
    } catch (err) {
      console.warn('Firestore user directory search warning:', err);
    }
  }

  const results = Array.from(byId.values());
  if (term) {
    results.sort((a, b) => {
      const aStarts =
        a.displayName.toLowerCase().startsWith(term) ||
        a.username.toLowerCase().startsWith(term) ||
        a.uniqueId.toLowerCase().startsWith(term);
      const bStarts =
        b.displayName.toLowerCase().startsWith(term) ||
        b.username.toLowerCase().startsWith(term) ||
        b.uniqueId.toLowerCase().startsWith(term);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  } else {
    results.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return results.slice(0, maxResults);
}

// =========================================================================
// REAL-TIME FOLLOW / FOLLOW BACK GRAPH (/userFollows)
// =========================================================================

export interface FollowEdgeState {
  followingIds: string[];
  followerIds: string[];
}

export function subscribeToMyFollowEdges(
  myUid: string,
  onUpdate: (state: FollowEdgeState) => void
): () => void {
  if (!myUid || !auth.currentUser?.uid) {
    onUpdate({ followingIds: [], followerIds: [] });
    return () => {};
  }

  let followingIds: string[] = [];
  let followerIds: string[] = [];

  const emit = () => {
    onUpdate({
      followingIds: Array.from(new Set(followingIds)),
      followerIds: Array.from(new Set(followerIds)),
    });
  };

  const qFollowing = query(collection(db, 'userFollows'), where('followerId', '==', myUid), limit(500));
  const qFollowers = query(collection(db, 'userFollows'), where('targetId', '==', myUid), limit(500));

  const unsub1 = onSnapshot(
    qFollowing,
    (snap) => {
      followingIds = snap.docs.map((d) => String((d.data() as any).targetId || '')).filter(Boolean);
      emit();
    },
    (err) => console.warn('Follow edges (following) listener error:', err)
  );

  const unsub2 = onSnapshot(
    qFollowers,
    (snap) => {
      followerIds = snap.docs.map((d) => String((d.data() as any).followerId || '')).filter(Boolean);
      emit();
    },
    (err) => console.warn('Follow edges (followers) listener error:', err)
  );

  return () => {
    unsub1();
    unsub2();
  };
}

export async function fetchUserFollowCounts(targetUid: string): Promise<{
  followersCount: number;
  followingCount: number;
}> {
  if (!targetUid || !auth.currentUser?.uid) {
    return { followersCount: 0, followingCount: 0 };
  }
  try {
    const [followersSnap, followingSnap] = await Promise.all([
      getDocs(query(collection(db, 'userFollows'), where('targetId', '==', targetUid), limit(500))),
      getDocs(query(collection(db, 'userFollows'), where('followerId', '==', targetUid), limit(500))),
    ]);
    return {
      followersCount: followersSnap.size,
      followingCount: followingSnap.size,
    };
  } catch {
    return { followersCount: 0, followingCount: 0 };
  }
}

export async function setUserFollowStateFirestore(params: {
  me: User;
  target: User;
  shouldFollow: boolean;
  isFollowBack?: boolean;
}): Promise<boolean> {
  const myUid = auth.currentUser?.uid;
  const targetId = params.target.id;
  if (!myUid || !targetId || myUid === targetId) return false;

  const edgeId = `${myUid}_${targetId}`;
  const path = `userFollows/${edgeId}`;
  try {
    const edgeRef = doc(db, 'userFollows', edgeId);
    if (params.shouldFollow) {
      await setDoc(edgeRef, {
        followerId: myUid,
        targetId,
        followerName: String(params.me.displayName || 'Alpha Mate').slice(0, 128),
        followerUsername: String(params.me.username || 'user').slice(0, 64),
        followerAvatar: String(params.me.avatar || '').slice(0, 1024),
        targetName: String(params.target.displayName || 'Alpha Mate').slice(0, 128),
        targetUsername: String(params.target.username || 'user').slice(0, 64),
        targetAvatar: String(params.target.avatar || '').slice(0, 1024),
        createdAt: new Date().toISOString(),
        createdAtMs: Date.now(),
      });

      sendFirestoreNotification({
        recipientId: targetId,
        type: 'follow',
        category: 'friendRequests',
        title: params.isFollowBack
          ? `🤝 ${params.me.displayName} followed you back!`
          : `⭐ ${params.me.displayName} started following you!`,
        message: params.isFollowBack
          ? `You and ${params.me.displayName} are now mutual friends on Alpha Mate.`
          : `${params.me.displayName} (@${params.me.username}) followed your profile.`,
        senderName: params.me.displayName,
        senderAvatar: params.me.avatar,
        screen: 'search',
      }).catch(() => {});
      return true;
    } else {
      await deleteDoc(edgeRef);
      return false;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return params.shouldFollow;
  }
}
