import { Component, signal, inject, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  quickReplies?: string[];
}

interface Intent {
  keywords: string[];
  response: string;
  quickReplies: string[];
}

const INTENTS: Intent[] = [
  {
    keywords: ['pedido', 'orden', 'compra', 'rastrear', 'tracking', 'donde', 'cuándo', 'cuando', 'llega', 'envío', 'envio', 'estado'],
    response: 'Para consultar el estado de tu pedido, ingresá a **Mis Pedidos** desde tu perfil. ¿Tenés el número de orden? Si me lo pasás, puedo ayudarte a encontrarlo.',
    quickReplies: ['Ver mis pedidos', 'Tengo el número de orden', 'Volver al inicio']
  },
  {
    keywords: ['devoluci', 'cambio', 'cambiar', 'devolver', 'reembolso', 'reclamo'],
    response: '📦 **Política de devoluciones:**\n\n• Tenés **30 días** desde la recepción para solicitar una devolución.\n• El producto debe estar sin usar y con etiquetas.\n• Las devoluciones se procesan en 5-7 días hábiles.\n\n¿Querés iniciar una devolución?',
    quickReplies: ['Iniciar devolución', 'Más información', 'Volver al inicio']
  },
  {
    keywords: ['talla', 'talle', 'medida', 'tamaño', 'talles'],
    response: '📏 **Guía de talles:**\n\nPodés encontrar la guía completa de talles en cada producto, o acceder desde el menú de ayuda. ¿Necesitás ayuda con una prenda específica?',
    quickReplies: ['Ver guía de talles', 'Volver al inicio']
  },
  {
    keywords: ['pago', 'cobro', 'mercadopago', 'tarjeta', 'efectivo', 'cuotas', 'precio'],
    response: '💳 **Métodos de pago disponibles:**\n\n• Tarjeta de crédito/débito (todas las marcas)\n• MercadoPago\n• Transferencia bancaria\n• Cuotas sin interés disponibles\n\n¿Necesitás más información sobre cuotas?',
    quickReplies: ['Consultar cuotas', 'Volver al inicio']
  },
  {
    keywords: ['flete', 'gratis', 'despacho', 'dias', 'días', 'demora'],
    response: '🚚 **Información de envíos:**\n\n• **CABA y GBA:** 2-3 días hábiles\n• **Interior del país:** 5-7 días hábiles\n• **Envío gratis** en compras mayores a $50.000\n• Podés seguir tu envío con el número de tracking',
    quickReplies: ['Rastrear mi envío', 'Volver al inicio']
  },
  {
    keywords: ['descuento', 'oferta', 'promo', 'cupon', 'cupón', 'codigo', 'código'],
    response: '🎁 **Descuentos y promociones:**\n\n• Seguinos en Instagram para enterarte de las ofertas\n• Suscribite al newsletter y recibí un 10% de descuento en tu primera compra\n• Chequeá la sección de Promociones en nuestra tienda',
    quickReplies: ['Ver promociones', 'Suscribirme al newsletter', 'Volver al inicio']
  },
  {
    keywords: ['contacto', 'telefono', 'teléfono', 'mail', 'email', 'hablar', 'atencion', 'atención', 'soporte', 'humano', 'persona'],
    response: '📞 **Contacto:**\n\n• **Email:** soporte@tienda.com\n• **WhatsApp:** +54 11 XXXX-XXXX\n• **Horario:** Lunes a Viernes de 9 a 18hs\n\nUn agente te responderá a la brevedad.',
    quickReplies: ['Volver al inicio']
  },
  {
    keywords: ['regalo', 'gift card', 'giftcard', 'tarjeta regalo'],
    response: '🎀 **Gift Cards:**\n\nTenemos Gift Cards disponibles desde $5.000 hasta $50.000. ¡Son el regalo perfecto! Podés comprarlas desde la sección Gift Cards.',
    quickReplies: ['Ver Gift Cards', 'Volver al inicio']
  }
];

const INITIAL_GREETING = '¡Hola! 👋 Soy el asistente de Tienda de Ropa. ¿En qué puedo ayudarte hoy?';
const INITIAL_QUICK_REPLIES = ['Estado de mi pedido', 'Devoluciones', 'Formas de pago', 'Envíos y demoras', 'Hablar con soporte'];

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Floating Chat Button -->
    <button
      class="chat-fab"
      (click)="toggleChat()"
      [class.has-unread]="unreadCount() > 0"
      [attr.aria-label]="chatOpen() ? 'Cerrar chat' : 'Abrir chat'"
      title="Chat de soporte">
      @if (chatOpen()) {
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      } @else {
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <line x1="9" y1="10" x2="15" y2="10"/>
          <line x1="12" y1="7" x2="12" y2="13"/>
        </svg>
        @if (unreadCount() > 0) {
          <span class="unread-badge">{{ unreadCount() > 9 ? '9+' : unreadCount() }}</span>
        }
      }
    </button>

    <!-- Chat Panel -->
    @if (chatOpen()) {
      <div class="chat-panel" role="dialog" aria-label="Asistente Virtual">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="support-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h3>Asistente Virtual</h3>
              <span class="status-online">En línea</span>
            </div>
          </div>
          <button class="chat-minimize" (click)="toggleChat()" aria-label="Minimizar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        <!-- Messages -->
        <div class="chat-messages" #messagesContainer>
          @for (msg of messages(); track msg.id) {
            <div class="message" [class.user-message]="msg.sender === 'user'" [class.support-message]="msg.sender === 'bot'">
              <div class="bot-message-block">
                <div class="message-bubble" [class.user-bubble]="msg.sender === 'user'" [class.support-bubble]="msg.sender === 'bot'">
                  @if (msg.sender === 'bot') {
                    <p [innerHTML]="formatMessage(msg.content)"></p>
                  } @else {
                    <p>{{ msg.content }}</p>
                  }
                  <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
                </div>
                @if (msg.sender === 'bot' && msg.quickReplies && msg.quickReplies.length > 0) {
                  <div class="quick-replies">
                    @for (qr of msg.quickReplies; track qr) {
                      <button class="quick-reply-btn" (click)="sendQuickReply(qr)">{{ qr }}</button>
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Typing indicator -->
          @if (isTyping()) {
            <div class="message support-message">
              <div class="message-bubble support-bubble typing">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
              </div>
            </div>
          }
        </div>

        <!-- Input area -->
        <div class="chat-input-area">
          <textarea
            class="chat-input"
            [(ngModel)]="newMessage"
            placeholder="Escribí tu mensaje..."
            (keydown.enter)="onEnter($event)"
            rows="1"
          ></textarea>
          <button
            class="send-btn"
            (click)="sendMessage()"
            [disabled]="!newMessage.trim()"
            aria-label="Enviar mensaje">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <!-- Footer -->
        <div class="chat-footer">
          <button class="new-chat-btn" (click)="newConversation()">↺ Nueva conversación</button>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Floating Chat Button */
    .chat-fab {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(var(--primary-rgb,224,32,200), 0.4);
      transition: all 0.2s;
      z-index: 900;
    }
    .chat-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(var(--primary-rgb,224,32,200), 0.5);
    }
    .chat-fab.has-unread { animation: pulse 2s infinite; }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 4px 16px rgba(var(--primary-rgb,224,32,200), 0.4); }
      50%       { box-shadow: 0 4px 24px rgba(var(--primary-rgb,224,32,200), 0.7); }
    }
    .unread-badge {
      position: absolute;
      top: -4px; right: -4px;
      background: var(--danger);
      color: white;
      font-size: 0.7rem; font-weight: 700;
      min-width: 20px; height: 20px;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px;
    }

    /* Chat Panel */
    .chat-panel {
      position: fixed;
      bottom: 5.5rem; right: 1.5rem;
      width: 360px;
      max-width: calc(100vw - 2rem);
      height: 520px;
      max-height: calc(100vh - 8rem);
      background: var(--bg-card);
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 899;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: white;
    }
    .chat-header-info { display: flex; align-items: center; gap: 0.75rem; }
    .support-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .chat-header h3 { margin: 0; font-size: 0.95rem; font-weight: 600; }
    .status-online {
      font-size: 0.75rem; color: rgba(255,255,255,0.85);
      display: flex; align-items: center; gap: 0.25rem;
    }
    .status-online::before {
      content: ''; width: 8px; height: 8px;
      background: #4ade80; border-radius: 50%;
    }
    .chat-minimize {
      background: rgba(255,255,255,0.2); border: none; border-radius: 8px;
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      color: white; cursor: pointer; transition: background 0.15s;
    }
    .chat-minimize:hover { background: rgba(255,255,255,0.3); }

    /* Messages */
    .chat-messages {
      flex: 1; overflow-y: auto;
      padding: 1rem;
      display: flex; flex-direction: column; gap: 0.75rem;
      background: var(--bg-secondary);
    }
    .chat-messages::-webkit-scrollbar { width: 6px; }
    .chat-messages::-webkit-scrollbar-track { background: transparent; }
    .chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    .message {
      display: flex; flex-direction: column;
      max-width: 85%;
    }
    .user-message { align-self: flex-end; }
    .support-message { align-self: flex-start; }

    .bot-message-block { display: flex; flex-direction: column; }

    .message-bubble {
      padding: 0.6rem 0.85rem; border-radius: 12px;
      font-size: 0.875rem; line-height: 1.5;
    }
    .user-bubble {
      background: var(--primary); color: white;
      border-bottom-right-radius: 4px;
    }
    .support-bubble {
      background: var(--bg-card); color: var(--text);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }
    .message-bubble p { margin: 0; }
    .message-time {
      display: flex; align-items: center; gap: 0.25rem;
      font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;
    }
    .user-bubble .message-time { color: rgba(255,255,255,0.7); }

    /* Quick replies */
    .quick-replies {
      display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem;
    }
    .quick-reply-btn {
      padding: 0.3rem 0.65rem;
      border: 1px solid var(--primary);
      background: transparent; color: var(--primary);
      border-radius: 20px; font-size: 0.78rem; cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .quick-reply-btn:hover { background: var(--primary); color: white; }

    /* Typing indicator */
    .typing {
      display: flex; gap: 4px; padding: 0.75rem 1rem;
    }
    .typing-dot {
      width: 8px; height: 8px;
      background: var(--text-secondary); border-radius: 50%;
      animation: typingBounce 1.4s infinite ease-in-out;
    }
    .typing-dot:nth-child(1) { animation-delay: 0s; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%           { transform: translateY(-4px); }
    }

    /* Input */
    .chat-input-area {
      display: flex; align-items: flex-end; gap: 0.5rem;
      padding: 0.75rem;
      background: var(--bg-card); border-top: 1px solid var(--border);
    }
    .chat-input {
      flex: 1; padding: 0.6rem 0.85rem;
      border: 1px solid var(--border); border-radius: 20px;
      font-size: 0.875rem; resize: none; font-family: inherit;
      max-height: 100px; overflow-y: auto;
      background: var(--bg-secondary); color: var(--text);
    }
    .chat-input:focus { outline: none; border-color: var(--primary); }
    .send-btn {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--primary); color: white; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .send-btn:hover:not(:disabled) { background: var(--primary-dark); transform: scale(1.05); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Footer */
    .chat-footer {
      padding: 0.4rem 1rem;
      background: var(--bg-card); border-top: 1px solid var(--border);
      display: flex; justify-content: center;
    }
    .new-chat-btn {
      background: none; border: none; color: var(--text-secondary);
      font-size: 0.78rem; cursor: pointer; text-decoration: underline; padding: 0.25rem;
      transition: color 0.15s;
    }
    .new-chat-btn:hover { color: var(--text); }

    /* Responsive */
    @media (max-width: 480px) {
      .chat-panel {
        bottom: 1rem; right: 1rem;
        width: calc(100vw - 2rem);
        height: calc(100vh - 6rem);
        max-height: 500px;
      }
      .chat-fab { bottom: 1rem; right: 1rem; }
    }
  `],
})
export class ChatWidgetComponent {
  private readonly platformId = inject(PLATFORM_ID);
  // Injected but unused — kept for future HTTP calls
  private readonly _auth = inject(AuthService);

  chatOpen    = signal(false);
  messages    = signal<ChatMessage[]>([]);
  newMessage  = '';
  unreadCount = signal(0);
  isTyping    = signal(false);

  private readonly STORAGE_KEY = 'bot_chat_messages';

  constructor() {
    this.loadMessages();
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  toggleChat(): void {
    this.chatOpen.update(open => !open);
    if (this.chatOpen()) {
      this.unreadCount.set(0);
      if (this.messages().length === 0) {
        this.showGreeting();
      }
    }
  }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const content = this.newMessage.trim();
    if (!content) return;

    const userMsg: ChatMessage = {
      id: this.generateId(),
      content,
      sender: 'user',
      timestamp: new Date(),
    };

    this.messages.update(msgs => [...msgs, userMsg]);
    this.newMessage = '';
    this.saveMessages();

    this.deliverBotResponse(content);
  }

  sendQuickReply(text: string): void {
    const userMsg: ChatMessage = {
      id: this.generateId(),
      content: text,
      sender: 'user',
      timestamp: new Date(),
    };
    this.messages.update(msgs => [...msgs, userMsg]);
    this.saveMessages();
    this.deliverBotResponse(text);
  }

  newConversation(): void {
    this.messages.set([]);
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
    }
    this.showGreeting();
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  formatMessage(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private showGreeting(): void {
    const greeting: ChatMessage = {
      id: this.generateId(),
      content: INITIAL_GREETING,
      sender: 'bot',
      timestamp: new Date(),
      quickReplies: INITIAL_QUICK_REPLIES,
    };
    this.messages.update(msgs => [...msgs, greeting]);
    this.saveMessages();
  }

  private deliverBotResponse(userText: string): void {
    this.isTyping.set(true);

    setTimeout(() => {
      this.isTyping.set(false);
      const { response, quickReplies } = this.processMessage(userText);
      const botMsg: ChatMessage = {
        id: this.generateId(),
        content: response,
        sender: 'bot',
        timestamp: new Date(),
        quickReplies,
      };
      this.messages.update(msgs => [...msgs, botMsg]);
      this.saveMessages();
      if (!this.chatOpen()) {
        this.unreadCount.update(n => n + 1);
      }
    }, 800);
  }

  private processMessage(text: string): { response: string; quickReplies: string[] } {
    const lower = text.toLowerCase();

    // "Volver al inicio" → greet again
    if (lower.includes('volver al inicio')) {
      return {
        response: INITIAL_GREETING,
        quickReplies: INITIAL_QUICK_REPLIES,
      };
    }

    // Order number detection: "ORD-123456" or a standalone digit sequence
    const orderMatch = text.match(/\b(ORD-\d+|\d{6,})\b/);
    if (orderMatch) {
      return {
        response: `Buscando tu pedido... Para ver el detalle del pedido **${orderMatch[0]}**, ingresá a Mis Pedidos desde tu perfil.`,
        quickReplies: ['Ver mis pedidos', 'Volver al inicio'],
      };
    }

    // Intent matching
    for (const intent of INTENTS) {
      if (intent.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        return { response: intent.response, quickReplies: intent.quickReplies };
      }
    }

    // Fallback
    return {
      response: 'No entendí bien tu consulta 😕 ¿Querés que te contacte con un agente? O elegí una opción:',
      quickReplies: INITIAL_QUICK_REPLIES,
    };
  }

  private loadMessages(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        const msgs = parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
        this.messages.set(msgs);
      }
    } catch { /* ignore */ }
  }

  private saveMessages(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.messages()));
    } catch { /* ignore */ }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}
