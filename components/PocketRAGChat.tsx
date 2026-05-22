/**
 * PocketRAGChat — AI First-Aid Chat Component
 *
 * ARCHITECTURE:
 * - Messages stored in local state (no persistence needed — this is emergency use)
 * - User types a question → answerQuestion() → response added to messages
 * - Suggested questions shown as quick-tap chips when chat is empty
 * - Shows "OFFLINE" badge when device has no internet
 *
 * WHY NO PERSISTENCE?
 * This is an emergency app. Chat history from previous sessions is
 * irrelevant and could be confusing. Each new emergency starts fresh.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { answerQuestion, getKnowledgeBaseSize } from '../services/PocketRAG';
import { SUGGESTED_QUESTIONS } from '../services/PocketRAG/types';
import type { ChatMessage } from '../services/PocketRAG/types';
import { Colors, BorderRadius, Shadows } from '../theme';

interface PocketRAGChatProps {
  /** Shown in header — passed from parent to add context */
  contextInjuryType?: string;
}

let messageIdCounter = 0;
function newId(): string {
  messageIdCounter += 1;
  return `msg_${Date.now()}_${messageIdCounter}`;
}

export function PocketRAGChat({ contextInjuryType }: PocketRAGChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = useCallback(async (text?: string) => {
    const query = (text ?? inputText).trim();
    if (!query || isLoading) return;

    setInputText('');
    setIsLoading(true);

    // Add user message immediately so they see their question
    const userMessage: ChatMessage = {
      id: newId(),
      role: 'user',
      text: query,
      timestamp: Date.now(),
      isOffline: false,
    };

    setMessages((prev) => [...prev, userMessage]);

    // Scroll to bottom
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // Get AI answer
    const response = await answerQuestion(query);

    const assistantMessage: ChatMessage = {
      id: newId(),
      role: 'assistant',
      text: response.answer,
      timestamp: Date.now(),
      isOffline: response.isOffline,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setIsLoading(false);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, isLoading]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}>
        {!isUser && (
          <View style={styles.avatarWrap}>
            <Ionicons name="medical" size={14} color={Colors.brand.primary} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
          ]}
        >
          <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
            {item.text}
          </Text>
          {!isUser && item.isOffline && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline-outline" size={10} color={Colors.label.tertiary} />
              <Text style={styles.offlineBadgeText}>Offline</Text>
            </View>
          )}
          {!isUser && !item.isOffline && (
            <View style={styles.onlineBadge}>
              <Ionicons name="sparkles" size={10} color={Colors.brand.accent} />
              <Text style={styles.onlineBadgeText}>Gemini AI</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const showSuggestions = messages.length === 0 && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
    >
      {/* Header info */}
      <View style={styles.infoBar}>
        <Ionicons name="library-outline" size={12} color={Colors.label.tertiary} />
        <Text style={styles.infoText}>
          {getKnowledgeBaseSize()} verified first-aid entries · Works offline
        </Text>
      </View>

      {/* Messages list */}
      {showSuggestions ? (
        <ScrollView
          style={styles.suggestionsScroll}
          contentContainerStyle={styles.suggestionsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.suggestionsTitle}>Quick questions:</Text>
          {SUGGESTED_QUESTIONS.map((q) => (
            <TouchableOpacity
              key={q}
              style={styles.suggestionChip}
              onPress={() => handleSend(q)}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.brand.primary} />
              <Text style={styles.suggestionText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingRow}>
          <View style={styles.avatarWrap}>
            <Ionicons name="medical" size={14} color={Colors.brand.primary} />
          </View>
          <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleLoading]}>
            <ActivityIndicator size="small" color={Colors.brand.primary} />
            <Text style={styles.loadingText}>Searching knowledge base...</Text>
          </View>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask a first-aid question..."
          placeholderTextColor={Colors.label.tertiary}
          multiline
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() || isLoading) && styles.sendBtnDisabled,
          ]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          activeOpacity={0.8}
        >
          <Ionicons
            name="send"
            size={18}
            color={!inputText.trim() || isLoading ? Colors.label.tertiary : '#fff'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background.elevated,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
  infoText: {
    fontSize: 11,
    color: Colors.label.tertiary,
    fontWeight: '500',
  },

  // Suggestions
  suggestionsScroll: { flex: 1 },
  suggestionsContent: {
    padding: 16,
    gap: 10,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.label.secondary,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.background.elevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    padding: 14,
    ...Shadows.xs,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: Colors.label.primary,
    lineHeight: 20,
  },

  // Messages
  messagesList: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.soft.red,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    padding: 12,
  },
  bubbleUser: {
    backgroundColor: Colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.background.elevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    ...Shadows.xs,
  },
  bubbleLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bubbleTextUser: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 21,
  },
  bubbleTextAssistant: {
    fontSize: 14,
    color: Colors.label.primary,
    lineHeight: 22,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  offlineBadgeText: {
    fontSize: 10,
    color: Colors.label.tertiary,
    fontWeight: '500',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  onlineBadgeText: {
    fontSize: 10,
    color: Colors.brand.accent,
    fontWeight: '600',
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.label.secondary,
    fontStyle: 'italic',
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background.elevated,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background.grouped,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: Colors.label.primary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border.medium,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    backgroundColor: Colors.background.secondary,
  },
});