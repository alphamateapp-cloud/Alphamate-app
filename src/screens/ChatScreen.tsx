import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TopBar } from '../components/navigation/TopBar';
import { Conversation, ChatMessage } from '../types';
import {
  Search,
  Users,
  User,
  ArrowLeft,
  Send,
  Image,
  Mic,
  Gift as GiftIcon,
  Smile,
  Check,
  CheckCheck,
  Play,
  Pause,
} from 'lucide-react';

export const ChatScreen: React.FC = () => {
  const {
    conversations,
    activeConversation,
    openConversation,
    sendMessage,
    navigateBack,
    currentUser,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'groups'>('all');

  // Inside conversation state
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);

  const emojis = ['💜', '🔥', '👑', '🎉', '💃', '✨', '🌹', '🚀', '💯', '👏'];

  const filteredConversations = conversations.filter((c) => {
    if (activeTab === 'direct' && c.isGroup) return false;
    if (activeTab === 'groups' && !c.isGroup) return false;
    if (searchQuery.trim()) {
      const name = c.isGroup ? c.groupName : c.user.displayName;
      return name?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !inputText.trim()) return;
    sendMessage(activeConversation.id, inputText.trim());
    setInputText('');
    setShowEmojiPicker(false);
  };

  const handleSendImage = () => {
    if (!activeConversation) return;
    const sampleImages = [
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80',
    ];
    sendMessage(activeConversation.id, '', sampleImages[Math.floor(Math.random() * sampleImages.length)]);
  };

  const handleSendVoiceNote = () => {
    if (!activeConversation) return;
    sendMessage(activeConversation.id, '🎙️ Voice note (0:14)');
  };

  // If inside a specific conversation
  if (activeConversation) {
    const isGroup = activeConversation.isGroup;
    const partner = activeConversation.user;

    return (
      <div className="relative w-full h-full h-[100dvh] max-h-[100dvh] bg-[#09070F] text-white flex flex-col justify-between overflow-hidden">
        {/* Chat Header */}
        <div className="pt-3 px-4 pb-3 flex items-center justify-between border-b border-[#A855F7]/15 bg-[#120A24] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => openConversation(null as any)}
              className="w-8 h-8 rounded-full bg-[#1C1236] flex items-center justify-center text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <img
                src={partner.avatar}
                alt={isGroup ? activeConversation.groupName : partner.displayName}
                className="w-10 h-10 rounded-full object-cover border border-[#A855F7]"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#120A24]" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white max-w-[170px] truncate">
                {isGroup ? activeConversation.groupName : partner.displayName}
              </h3>
              <p className="text-[10px] text-emerald-400 font-semibold">Active now</p>
            </div>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {activeConversation.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[78%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                  msg.isMe
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#9333EA] text-white rounded-br-none shadow-md shadow-[#7928CA]/30'
                    : 'bg-[#181131] border border-[#A855F7]/20 text-zinc-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.text && <p>{msg.text}</p>}

                {msg.imageUrl && (
                  <div className="rounded-xl overflow-hidden mt-1 mb-1 max-w-[200px]">
                    <img src={msg.imageUrl} alt="Attachment" className="w-full h-auto object-cover" />
                  </div>
                )}
              </div>

              {/* Timestamp and Delivery checkmark */}
              <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
                <span>{msg.timestamp}</span>
                {msg.isMe && (
                  <CheckCheck className="w-3.5 h-3.5 text-[#C084FC]" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Emoji Selector Tray */}
        {showEmojiPicker && (
          <div className="p-2.5 bg-[#140D28] border-t border-[#A855F7]/20 flex items-center justify-around">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setInputText((prev) => prev + emoji)}
                className="text-xl hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-[#100A22] border-t border-[#A855F7]/15 flex items-center gap-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-zinc-400 hover:text-white"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={handleSendImage}
            className="text-zinc-400 hover:text-white"
            title="Attach Photo"
          >
            <Image className="w-5 h-5" />
          </button>

          <button
            onClick={handleSendVoiceNote}
            className="text-zinc-400 hover:text-white"
            title="Send Voice Memo"
          >
            <Mic className="w-5 h-5" />
          </button>

          <form onSubmit={handleSendMessage} className="flex-1 flex items-center">
            <input
              type="text"
              placeholder="Type message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full h-10 px-3.5 rounded-full bg-[#181030] border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-[#A855F7]"
            />
          </form>

          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white disabled:opacity-40 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Conversation List Screen
  return (
    <div className="relative w-full h-full min-h-screen pb-32 bg-[#09070F] text-white overflow-y-auto">
      <TopBar />

      {/* Header Search & Tabs */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-[#140E28] border border-[#A855F7]/20 text-white placeholder-zinc-500 text-xs focus:border-[#A855F7] focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['all', 'direct', 'groups'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-white shadow-md'
                  : 'bg-[#150F2C] text-zinc-400 hover:text-white border border-[#A855F7]/15'
              }`}
            >
              {tab === 'all' ? 'All Messages' : tab === 'direct' ? '1-on-1' : 'Group Chats'}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="px-4 py-2 divide-y divide-[#A855F7]/10">
        {filteredConversations.map((conv) => {
          const partner = conv.user;
          const isGroup = conv.isGroup;

          return (
            <div
              key={conv.id}
              onClick={() => openConversation(conv)}
              className="py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={partner.avatar}
                    alt={isGroup ? conv.groupName : partner.displayName}
                    className="w-13 h-13 rounded-full object-cover border border-[#A855F7]/30"
                  />
                  {!isGroup && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#09070F]" />
                  )}
                  {isGroup && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#7928CA] flex items-center justify-center">
                      <Users className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white max-w-[170px] truncate">
                    {isGroup ? conv.groupName : partner.displayName}
                  </h4>
                  <p className="text-xs text-zinc-400 line-clamp-1 max-w-[190px] mt-0.5">
                    {conv.lastMessage}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[10px] text-zinc-500 font-medium">{conv.lastTimestamp}</span>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#EC4899] text-[10px] font-bold text-white flex items-center justify-center shadow-sm">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
