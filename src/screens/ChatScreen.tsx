import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { acceptChatRequest, rejectOrBlockChatRequest, subscribeToMyChatRequests, subscribeToMyChats, subscribeToChatMessages, createGroupChat, sendChatMessage, sendChatRequest, setChatPresence, uploadChatMedia, markChatMessageRead, deleteChatMessage, subscribeToMyGroupInvites, respondToGroupInvite } from '../services/chatService';
import { auth } from '../services/firebase';
import { Conversation, User, ChatMessage } from '../types';
import {
  Search, Users, UserPlus, ArrowLeft, Send, Image as ImageIcon, Mic, Smile,
  CheckCheck, Phone, Video, MoreVertical, Paperclip, Camera, X, Plus,
  MessageCircle, ShieldCheck, Ban, Trash2, Pencil, Reply, Check, UserRound,
  FileVideo, Link as LinkIcon, Music2, CircleDot, PhoneCall
} from 'lucide-react';

type RequestItem = { id: string; user: User; message: string; time: string };
type LocalMessage = ChatMessage & { replyTo?: string; deletedForEveryone?: boolean; edited?: boolean; kind?: 'text'|'image'|'video'|'audio'|'link' };
const STORE_KEY = 'alpha_mate_chat_requests_v2';
const EMOJIS = ['💜','❤️','😂','😍','🔥','👑','🎉','🥰','👏','✨','🌹','👍'];

export const ChatScreen: React.FC = () => {
  const { conversations, activeConversation, openConversation, sendMessage, currentUser, registeredUsers, startDirectMessage } = useApp();
  const [tab, setTab] = useState<'chats'|'requests'>('chats');
  const [filter, setFilter] = useState<'all'|'direct'|'groups'>('all');
  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
  });
  const [showNew, setShowNew] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [menuMessage, setMenuMessage] = useState<LocalMessage|null>(null);
  const [replyTo, setReplyTo] = useState<LocalMessage|null>(null);
  const [editMessage, setEditMessage] = useState<LocalMessage|null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [callState, setCallState] = useState<'idle'|'voice'|'video'>('idle');
  const [localGroups, setLocalGroups] = useState<Conversation[]>([]);
  const [firebaseChats, setFirebaseChats] = useState<Conversation[]>([]);
  const [firebaseMessages, setFirebaseMessages] = useState<LocalMessage[]>([]);
  const [groupInvites, setGroupInvites] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(requests)); }, [requests]);
  useEffect(() => {
    if (!auth.currentUser?.uid || auth.currentUser.uid !== currentUser.id) return;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeChats: (() => void) | undefined;
    let unsubscribeGroupInvites: (() => void) | undefined;
    try {
      unsubscribe = subscribeToMyChatRequests(items => setRequests(items.map((item: any) => ({
        id: item.id, user: ({ id: item.sender?.id || item.senderId, displayName: item.sender?.displayName || 'Alpha Mate User', username: item.sender?.username || '', avatar: item.sender?.avatar || '' } as User),
        message: item.firstMessage || '', time: item.createdAt?.toDate?.()?.toLocaleString?.() || 'Just now'
      }))));
      unsubscribeChats = subscribeToMyChats(items => setFirebaseChats(items.map((item: any) => {
        const otherId = (item.participantIds || []).find((id: string) => id !== currentUser.id);
        const profile = item.participantProfiles?.[otherId] || {};
        const isGroup = item.type === 'group';
        return { id: item.id, inviteStatus: item.memberStatus?.[currentUser.id], user: { id: otherId || currentUser.id, displayName: profile.displayName || 'Alpha Mate User', username: profile.username || '', avatar: profile.avatar || '' } as User, groupName: item.groupName, isGroup, groupMembers: Object.entries(item.participantProfiles || {}).map(([id, value]: any) => ({ id, ...value } as User)), lastMessage: item.lastMessage || '', lastTimestamp: item.updatedAt?.toDate?.()?.toLocaleString?.() || '', unreadCount: Number(item.unreadBy?.[currentUser.id] || 0), messages: [] } as Conversation;
      })));
      unsubscribeGroupInvites = subscribeToMyGroupInvites(setGroupInvites);
      setChatPresence(true).catch(() => {});
    } catch (error) { console.warn('Chat request listener unavailable:', error); }
    const handleOffline = () => setChatPresence(false).catch(() => {});
    window.addEventListener('pagehide', handleOffline);
    return () => { unsubscribe?.(); unsubscribeChats?.(); unsubscribeGroupInvites?.(); window.removeEventListener('pagehide', handleOffline); setChatPresence(false).catch(() => {}); };
  }, [currentUser.id]);
  useEffect(() => {
    if (!activeConversation?.id || !auth.currentUser || auth.currentUser.uid !== currentUser.id) { setFirebaseMessages([]); return; }
    if (!firebaseChats.some(c => c.id === activeConversation.id)) { setFirebaseMessages([]); return; }
    return subscribeToChatMessages(activeConversation.id, items => { items.forEach((m: any) => { if (m.senderId !== currentUser.id && !(m.readBy || []).includes(currentUser.id)) markChatMessageRead(activeConversation.id, m.id).catch(() => {}); }); setFirebaseMessages(items.map((m: any) => ({ id: m.id, senderId: m.senderId, senderName: m.senderId === currentUser.id ? currentUser.displayName : (activeConversation.user?.displayName || 'Member'), senderAvatar: m.senderId === currentUser.id ? currentUser.avatar : (activeConversation.user?.avatar || ''), text: m.deletedForEveryone ? 'This message was deleted' : (m.text || ''), imageUrl: m.mediaUrl || undefined, timestamp: m.createdAt?.toDate?.()?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || '', isRead: (m.readBy || []).length > 1, isMe: m.senderId === currentUser.id, edited: !!m.edited, replyTo: m.replyTo } as LocalMessage))); });
  }, [activeConversation?.id, firebaseChats.length, currentUser.id]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeConversation?.messages.length]);

  const allConversations = useMemo(() => [...firebaseChats, ...localGroups.filter(g => !firebaseChats.some(f => f.id === g.id)), ...conversations.filter(c => !firebaseChats.some(f => f.id === c.id))], [firebaseChats, localGroups, conversations]);
  const filtered = allConversations.filter(c => {
    if (filter === 'direct' && c.isGroup) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    const name = c.isGroup ? c.groupName : c.user?.displayName;
    return !query.trim() || (name || '').toLowerCase().includes(query.toLowerCase());
  });
  const foundUsers = registeredUsers.filter(u => u.id !== currentUser.id &&
    (`${u.displayName} ${u.username} ${u.uniqueId}`).toLowerCase().includes(query.toLowerCase())).slice(0, 12);

  const openUser = async (user: User) => {
    const existing = allConversations.find(c => !c.isGroup && c.user?.id === user.id);
    if (existing) openConversation(existing);
    else if (auth.currentUser?.uid === currentUser.id) {
      try { await sendChatRequest({ id: user.id, displayName: user.displayName, username: user.username, avatar: user.avatar }, `Hi ${user.displayName}, I would like to connect with you on Alpha Mate 💜`); window.alert('Message request sent. You can chat after they accept.'); }
      catch (error) { window.alert(error instanceof Error ? error.message : 'Unable to send request.'); }
    } else startDirectMessage(user);
    setShowNew(false); setShowSearch(false); setQuery('');
  };
  const acceptRequest = async (r: RequestItem) => {
    try {
      if (auth.currentUser?.uid === currentUser.id) {
        const chatId = await acceptChatRequest(r.id);
        const conv: Conversation = { id: chatId, user: r.user, lastMessage: r.message, lastTimestamp: r.time, unreadCount: 1, isGroup: false, messages: [{ id: `request_${r.id}`, senderId: r.user.id, senderName: r.user.displayName, senderAvatar: r.user.avatar, text: r.message, timestamp: r.time, isRead: false, isMe: false }] };
        setRequests(prev => prev.filter(x => x.id !== r.id)); openConversation(conv); return;
      }
    } catch (error) { console.error('Accept chat request failed:', error); }
    const conv: Conversation = { id: `request_${r.id}`, user: r.user, lastMessage: r.message, lastTimestamp: r.time, unreadCount: 1, isGroup: false, messages: [{ id: `reqmsg_${r.id}`, senderId: r.user.id, senderName: r.user.displayName, senderAvatar: r.user.avatar, text: r.message, timestamp: r.time, isRead: false, isMe: false }] };
    setRequests(prev => prev.filter(x => x.id !== r.id)); openConversation(conv);
  };
  const send = (text = draft, mediaUrl?: string, kind: LocalMessage['kind'] = 'text') => {
    if (!activeConversation || (!text.trim() && !mediaUrl)) return;
    if (editMessage) {
      if (auth.currentUser?.uid === currentUser.id && firebaseChats.some(c => c.id === activeConversation.id)) { import('../services/chatService').then(m => m.editChatMessage(activeConversation.id, editMessage.id, text)).catch(e => console.error(e)); }
      setEditMessage(null); setDraft('');
      return;
    }
    const messageText = text.trim() || (kind === 'image' ? 'Photo' : kind === 'video' ? 'Video' : kind === 'audio' ? 'Voice message' : 'Shared link');
    if (auth.currentUser?.uid === currentUser.id && firebaseChats.some(c => c.id === activeConversation.id)) {
      sendChatMessage(activeConversation.id, { text: messageText, mediaUrl, mediaType: kind === 'text' || kind === 'link' ? undefined : kind, replyTo: replyTo?.id }).catch(error => console.error('Firebase chat send failed:', error));
    }
    if (localGroups.some(group => group.id === activeConversation.id)) {
      const newMessage: LocalMessage = { id: `group_msg_${Date.now()}`, senderId: currentUser.id, senderName: currentUser.displayName, senderAvatar: currentUser.avatar, text: messageText, imageUrl: mediaUrl, timestamp: 'Just now', isRead: false, isMe: true, kind };
      const updated = { ...activeConversation, lastMessage: messageText, lastTimestamp: 'Just now', messages: [...activeConversation.messages, newMessage] };
      setLocalGroups(prev => prev.map(group => group.id === updated.id ? updated : group));
      openConversation(updated);
    } else {
      sendMessage(activeConversation.id, messageText, mediaUrl);
    }
    setDraft(''); setReplyTo(null); setShowEmoji(false);
  };
  const handleFile = async (file?: File) => {
    if (!file || !activeConversation) return;
    const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
    try {
      if (auth.currentUser?.uid === currentUser.id && firebaseChats.some(c => c.id === activeConversation.id)) {
        const url = await uploadChatMedia(activeConversation.id, file);
        await sendChatMessage(activeConversation.id, { text: file.name, mediaUrl: url, mediaType: kind });
      } else {
        const reader = new FileReader();
        reader.onload = () => send(file.name, String(reader.result), kind);
        reader.readAsDataURL(file);
      }
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Upload failed.'); }
    setShowAttach(false);
  };
  const createGroup = () => {
    if (!groupName.trim() || selectedMembers.length < 1) return;
    const members = registeredUsers.filter(u => selectedMembers.includes(u.id));
    const makeGroup = async () => {
      let groupId = `group_${Date.now()}`;
      if (auth.currentUser?.uid === currentUser.id) {
        try { groupId = await createGroupChat(groupName.trim(), members.map(m => ({ id: m.id, displayName: m.displayName, username: m.username, avatar: m.avatar }))); }
        catch (error) { console.error('Firebase group creation failed:', error); }
      }
      const group: Conversation = { id: groupId, user: currentUser, lastMessage: 'Group created · invitations sent', lastTimestamp: 'Just now', unreadCount: 0, isGroup: true, groupName: groupName.trim(), groupMembers: [currentUser, ...members], messages: [] };
      setLocalGroups(prev => [group, ...prev]); setGroupName(''); setSelectedMembers([]); setShowGroup(false); setShowNew(false); openConversation(group);
    };
    void makeGroup();
  };

  if (activeConversation) {
    const partner = activeConversation.user;
    const messages = (firebaseChats.some(c => c.id === activeConversation.id) ? firebaseMessages : activeConversation.messages) as LocalMessage[];
    return <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#090510] text-white">
      <header className="shrink-0 border-b border-purple-500/20 bg-[#130922]/95 px-3 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button onClick={() => openConversation(null as any)} className="rounded-full p-2 text-zinc-300 hover:bg-white/10"><ArrowLeft size={21}/></button>
          <div className="relative">
            <img src={activeConversation.isGroup ? (activeConversation.groupMembers?.[0]?.avatar || partner?.avatar) : partner?.avatar} className="h-11 w-11 rounded-full border border-fuchsia-400/60 object-cover" />
            {!activeConversation.isGroup && <i className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#130922] bg-emerald-400"/>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">{activeConversation.isGroup ? activeConversation.groupName : partner?.displayName}</div>
            <div className="text-[11px] text-emerald-400">{activeConversation.isGroup ? `${activeConversation.groupMembers?.length || 1} members` : 'Online'}</div>
          </div>
          <button onClick={() => setCallState('voice')} className="rounded-full p-2.5 text-emerald-300 hover:bg-emerald-400/10" title="Voice call"><Phone size={19}/></button>
          <button onClick={() => setCallState('video')} className="rounded-full p-2.5 text-fuchsia-300 hover:bg-fuchsia-400/10" title="Video call"><Video size={20}/></button>
          <button onClick={() => setShowAttach(v => !v)} className="rounded-full p-2 text-zinc-300"><MoreVertical size={20}/></button>
        </div>
      </header>
      {callState !== 'idle' && <div className="mx-3 mt-3 flex items-center justify-between rounded-2xl border border-purple-400/30 bg-purple-950/70 p-3"><div className="flex items-center gap-2"><PhoneCall size={17} className="text-emerald-300"/><div><p className="text-sm font-semibold">{callState === 'voice' ? 'Voice call' : 'Video call'}</p><p className="text-[10px] text-zinc-400">Call UI preview — calling service required</p></div></div><button onClick={() => setCallState('idle')} className="rounded-full bg-rose-500/20 p-2 text-rose-300"><X size={17}/></button></div>}
      <main className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#291044_0%,_#10091c_42%,_#090510_100%)] px-3 py-4">
        <div className="mx-auto w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] text-zinc-400">Today · Alpha Mate Chat</div>
        {messages.map((msg) => <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[82%] ${msg.isMe ? 'items-end' : 'items-start'} flex flex-col`}>
            {msg.replyTo && <div className="mb-1 rounded-lg bg-black/30 px-3 py-1 text-[10px] text-purple-200">Replying to a message</div>}
            <button onContextMenu={e => { e.preventDefault(); setMenuMessage(msg); }} onClick={() => setMenuMessage(msg)} className={`rounded-2xl px-3.5 py-2.5 text-left text-[13px] leading-relaxed shadow-lg ${msg.isMe ? 'rounded-br-sm bg-gradient-to-br from-[#8B27D8] to-[#D52DAB]' : 'rounded-bl-sm border border-purple-400/15 bg-[#211332]'}`}>
              {msg.imageUrl && (msg.imageUrl.startsWith('data:video') ? <video src={msg.imageUrl} controls className="mb-2 max-h-48 rounded-xl"/> : <img src={msg.imageUrl} className="mb-2 max-h-52 rounded-xl object-cover"/>)}
              {msg.text && <span>{msg.text}</span>}
              {msg.edited && <span className="ml-2 text-[9px] opacity-70">edited</span>}
            </button>
            <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-zinc-500"><span>{msg.timestamp}</span>{msg.isMe && <CheckCheck size={13} className="text-cyan-300"/>}</div>
          </div>
        </div>)}
        <div ref={chatEndRef}/>
      </main>
      {menuMessage && <div className="absolute inset-0 z-30 flex items-end bg-black/55 p-3" onClick={() => setMenuMessage(null)}><div onClick={e => e.stopPropagation()} className="w-full rounded-3xl border border-purple-400/30 bg-[#1b102b] p-3 shadow-2xl">
        <div className="mb-2 flex justify-around border-b border-white/10 pb-3">{['👍','❤️','😂','😮','😢','🔥'].map(e => <button key={e} onClick={() => setMenuMessage(null)} className="text-2xl">{e}</button>)}</div>
        <button onClick={() => { setReplyTo(menuMessage); setMenuMessage(null); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5"><Reply size={17}/> Reply</button>
        {menuMessage.isMe && <button onClick={() => { setEditMessage(menuMessage); setDraft(menuMessage.text || ''); setMenuMessage(null); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5"><Pencil size={17}/> Edit message</button>}
        <button onClick={() => { if (auth.currentUser?.uid === currentUser.id && firebaseChats.some(c => c.id === activeConversation.id)) deleteChatMessage(activeConversation.id, menuMessage.id, false).catch(e => console.error(e)); setMenuMessage(null); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm hover:bg-white/5"><Trash2 size={17}/> Delete for me</button>
        {menuMessage.isMe && <button onClick={() => { if (auth.currentUser?.uid === currentUser.id && firebaseChats.some(c => c.id === activeConversation.id)) deleteChatMessage(activeConversation.id, menuMessage.id, true).catch(e => console.error(e)); setMenuMessage(null); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-rose-300 hover:bg-white/5"><Trash2 size={17}/> Delete for everyone</button>}
      </div></div>}
      {showEmoji && <div className="grid grid-cols-6 gap-2 border-t border-purple-400/20 bg-[#160d25] p-3">{EMOJIS.map(e => <button key={e} onClick={() => setDraft(v => v + e)} className="text-2xl">{e}</button>)}</div>}
      {showAttach && <div className="grid grid-cols-4 gap-2 border-t border-purple-400/20 bg-[#160d25] p-3">
        <button onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-purple-200"><Camera className="text-fuchsia-300"/>Camera</button>
        <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-purple-200"><ImageIcon className="text-cyan-300"/>Gallery</button>
        <button onClick={() => videoRef.current?.click()} className="flex flex-col items-center gap-1 text-xs text-purple-200"><FileVideo className="text-pink-300"/>Video</button>
        <button onClick={() => { setDraft(v => v + ' https://'); setShowAttach(false); }} className="flex flex-col items-center gap-1 text-xs text-purple-200"><LinkIcon className="text-amber-300"/>Link</button>
      </div>}
      {replyTo && <div className="flex items-center justify-between border-t border-purple-400/20 bg-[#190f2b] px-4 py-2 text-xs"><span className="text-purple-200">Replying to: {replyTo.text?.slice(0,50) || 'attachment'}</span><button onClick={() => setReplyTo(null)}><X size={15}/></button></div>}
      {editMessage && <div className="flex items-center justify-between border-t border-purple-400/20 bg-[#190f2b] px-4 py-2 text-xs text-amber-200"><span>Editing message</span><button onClick={() => {setEditMessage(null);setDraft('');}}><X size={15}/></button></div>}
      <form onSubmit={e => { e.preventDefault(); send(); }} className="flex shrink-0 items-center gap-2 border-t border-purple-400/20 bg-[#10091d] px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => setShowAttach(v => !v)} className="rounded-full bg-purple-500/15 p-2.5 text-purple-200"><Plus size={21}/></button>
        <button type="button" onClick={() => setShowEmoji(v => !v)} className="text-zinc-400"><Smile size={21}/></button>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message..." className="h-11 min-w-0 flex-1 rounded-full border border-purple-400/25 bg-[#21152f] px-4 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-fuchsia-400"/>
        {draft.trim() ? <button className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white"><Send size={17}/></button> : <button type="button" onClick={() => send('🎙️ Voice message (0:08)')} className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white"><Mic size={18}/></button>}
      </form>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])}/>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFile(e.target.files?.[0])}/>
      <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])}/>
    </div>;
  }

  return <div className="min-h-full bg-[#090510] pb-28 text-white">
    <header className="sticky top-0 z-10 border-b border-purple-500/15 bg-[#10091d]/95 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between"><div><h1 className="text-2xl font-black tracking-tight">Chats</h1><p className="mt-0.5 text-[11px] text-zinc-500">Your conversations, all in one place</p></div><div className="flex gap-2"><button onClick={() => {setShowSearch(true);setQuery('');}} className="rounded-full border border-purple-400/20 bg-purple-500/10 p-3 text-purple-200"><Search size={19}/></button><button onClick={() => setShowNew(true)} className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 p-3 text-white shadow-lg shadow-purple-900/30"><Plus size={19}/></button></div></div>
      {showSearch && <div className="mb-3 flex items-center gap-2 rounded-2xl border border-purple-400/30 bg-[#21152f] px-3"><Search size={17} className="text-purple-300"/><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or username..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"/><button onClick={() => {setShowSearch(false);setQuery('');}}><X size={17}/></button></div>}
      <div className="grid grid-cols-2 rounded-2xl border border-purple-400/20 bg-[#1a1028] p-1"><button onClick={() => setTab('chats')} className={`rounded-xl py-2.5 text-sm font-bold ${tab==='chats'?'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white':'text-zinc-400'}`}>Chats <span className="ml-1 text-[10px]">{allConversations.length}</span></button><button onClick={() => setTab('requests')} className={`rounded-xl py-2.5 text-sm font-bold ${tab==='requests'?'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white':'text-zinc-400'}`}>Requests {requests.length>0 && <span className="ml-1 rounded-full bg-pink-500 px-1.5 py-0.5 text-[10px]">{requests.length}</span>}</button></div>
      {tab==='chats' && <div className="mt-3 flex gap-2">{(['all','direct','groups'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${filter===f?'bg-purple-600 text-white':'border border-purple-400/15 bg-[#1b1129] text-zinc-400'}`}>{f==='all'?'All chats':f==='direct'?'Private':'Groups'}</button>)}</div>}
    </header>
    {tab==='requests' ? <section className="space-y-3 p-4"><div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-100"><ShieldCheck size={16} className="mr-2 inline"/>Messages from people who are not in your chats appear here. Accept to start chatting, or block the sender.</div>{groupInvites.map(invite => <div key={invite.id} className="rounded-2xl border border-fuchsia-400/25 bg-[#1b102b] p-3"><p className="text-sm font-bold">{invite.groupName || 'Group invitation'}</p><p className="mt-1 text-xs text-zinc-400">You have been invited to join this group.</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => respondToGroupInvite(invite.chatId, true).then(() => setGroupInvites(v => v.filter(x => x.id !== invite.id))).catch(e => window.alert(e.message))} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold">Accept Group</button><button onClick={() => respondToGroupInvite(invite.chatId, false).then(() => setGroupInvites(v => v.filter(x => x.id !== invite.id))).catch(e => window.alert(e.message))} className="rounded-xl border border-rose-400/30 py-2 text-xs font-bold text-rose-300">Decline</button></div></div>)}{requests.length===0 && groupInvites.length===0 ? <EmptyState title="No message requests" subtitle="New messages from unknown users will appear here."/> : requests.map(r => <div key={r.id} className="rounded-2xl border border-purple-400/20 bg-[#160d25] p-3"><div className="flex items-center gap-3"><img src={r.user.avatar} className="h-12 w-12 rounded-full object-cover"/><div className="min-w-0 flex-1"><p className="font-bold">{r.user.displayName}</p><p className="text-[11px] text-zinc-500">@{r.user.username} · {r.time}</p><p className="mt-1 truncate text-xs text-zinc-300">{r.message}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => acceptRequest(r)} className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2 text-xs font-bold">Accept</button><button onClick={() => { if (auth.currentUser?.uid === currentUser.id) rejectOrBlockChatRequest(r.id, true).catch(e => console.error(e)); setRequests(prev => prev.filter(x => x.id!==r.id)); }} className="rounded-xl border border-rose-400/30 py-2 text-xs font-bold text-rose-300"><Ban size={13} className="mr-1 inline"/>Block</button></div></div>)}</section> : <section className="p-3">
      {showSearch && query.trim() && <div className="mb-3"><p className="px-2 pb-2 text-xs font-bold text-purple-200">Find people</p>{foundUsers.map(u => <button key={u.id} onClick={() => openUser(u)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5"><img src={u.avatar} className="h-10 w-10 rounded-full object-cover"/><span className="min-w-0 flex-1"><b className="block text-sm">{u.displayName}</b><small className="text-zinc-500">@{u.username} · ID {u.uniqueId}</small></span><MessageCircle size={18} className="text-purple-300"/></button>)}</div>}
      {filtered.length===0 ? <EmptyState title="No chats yet" subtitle="Search for a user or start a group conversation."/> : filtered.map(c => <button key={c.id} onClick={() => openConversation(c)} className="flex w-full items-center gap-3 border-b border-purple-400/10 px-2 py-3.5 text-left hover:bg-white/[0.03]"><div className="relative shrink-0"><img src={c.isGroup ? (c.groupMembers?.[0]?.avatar || c.user.avatar) : c.user.avatar} className="h-14 w-14 rounded-full border border-purple-400/30 object-cover"/>{!c.isGroup && <i className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#090510] bg-emerald-400"/>}{c.isGroup && <span className="absolute -bottom-1 -right-1 rounded-full bg-purple-600 p-1"><Users size={11}/></span>}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{c.isGroup?c.groupName:c.user.displayName}</b><span className="shrink-0 text-[10px] text-zinc-500">{c.lastTimestamp}</span></div><div className="mt-1 flex items-center justify-between gap-2"><p className="truncate text-xs text-zinc-400">{c.lastMessage}</p>{c.unreadCount>0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold">{c.unreadCount}</span>}</div></div></button>)}
    </section>}
    {showNew && <div className="fixed inset-0 z-30 flex items-end bg-black/65" onClick={() => setShowNew(false)}><div onClick={e=>e.stopPropagation()} className="w-full rounded-t-3xl border border-purple-400/30 bg-[#170d26] p-5 pb-[max(24px,env(safe-area-inset-bottom))]"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">Start a conversation</h2><button onClick={() => setShowNew(false)}><X/></button></div><button onClick={() => {setShowNew(false);setShowSearch(true);setTab('chats');}} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-purple-400/20 bg-[#241436] p-4 text-left"><Search className="text-fuchsia-300"/><span><b className="block text-sm">Find a user</b><small className="text-zinc-400">Search by name or username</small></span></button><button onClick={() => {setShowGroup(true);setShowNew(false);}} className="flex w-full items-center gap-3 rounded-2xl border border-purple-400/20 bg-[#241436] p-4 text-left"><Users className="text-purple-300"/><span><b className="block text-sm">Create a group</b><small className="text-zinc-400">Add people and chat together</small></span></button></div></div>}
    {showGroup && <div className="fixed inset-0 z-40 flex items-end bg-black/70" onClick={() => setShowGroup(false)}><div onClick={e=>e.stopPropagation()} className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border border-purple-400/30 bg-[#170d26] p-5 pb-[max(24px,env(safe-area-inset-bottom))]"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">Create group</h2><button onClick={() => setShowGroup(false)}><X/></button></div><input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Group name" className="mb-4 h-12 w-full rounded-xl border border-purple-400/25 bg-[#241436] px-4 text-sm outline-none"/><p className="mb-2 text-xs font-bold text-purple-200">Add members</p>{registeredUsers.filter(u=>u.id!==currentUser.id).map(u=><button key={u.id} onClick={()=>setSelectedMembers(prev=>prev.includes(u.id)?prev.filter(x=>x!==u.id):[...prev,u.id])} className="flex w-full items-center gap-3 rounded-xl p-2 text-left"><img src={u.avatar} className="h-10 w-10 rounded-full object-cover"/><span className="flex-1 text-sm">{u.displayName}<small className="block text-zinc-500">@{u.username}</small></span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selectedMembers.includes(u.id)?'border-purple-400 bg-purple-600':'border-zinc-600'}`}>{selectedMembers.includes(u.id)&&<Check size={13}/>}</span></button>)}<button onClick={createGroup} disabled={!groupName.trim()||selectedMembers.length===0} className="mt-4 w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-3 text-sm font-bold disabled:opacity-40">Create group · {selectedMembers.length} selected</button></div></div>}
  </div>;
};

const EmptyState: React.FC<{title:string;subtitle:string}> = ({title,subtitle}) => <div className="flex flex-col items-center px-8 py-16 text-center"><div className="mb-4 rounded-full border border-purple-400/20 bg-purple-500/10 p-5 text-purple-300"><MessageCircle size={30}/></div><h3 className="font-bold">{title}</h3><p className="mt-1 text-xs text-zinc-500">{subtitle}</p></div>;
