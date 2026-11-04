import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '@core/services/auth.service';
import { CartService } from '@core/services/cart.service';
import { ProductService } from '@core/services/product.service';
import { WishlistService } from '@core/services/wishlist.service';
import { NotificationService } from '@core/services/notification.service';
import { ThemeService } from '@core/services/theme.service';
import { TranslationService } from '@core/services/translation.service';
import { WebPushService } from '@core/services/web-push.service';
import { signal, computed, Signal } from '@angular/core';
import { Cart } from '@core/models/cart.model';
import { UserInfo } from '@core/models/auth.model';

/** Mock services with real signals for testing. */
class MockAuthService {
  readonly isAuthenticated = computed(() => this._isAuth());
  readonly isAdmin = computed(() => this._isAdmin());
  readonly user: Signal<UserInfo | null>;
  private _isAuth = signal(false);
  private _isAdmin = signal(false);
  private _user = signal<UserInfo | null>(null);

  constructor() {
    this.user = this._user.asReadonly();
  }

  setAuth(value: boolean) { this._isAuth.set(value); }
  setAdmin(value: boolean) { this._isAdmin.set(value); }
  setUser(user: UserInfo | null) { this._user.set(user); }
  logout() {}
}

class MockCartService {
  readonly cart: Signal<Cart | null>;
  private _cart = signal<Cart | null>(null);

  constructor() {
    this.cart = this._cart.asReadonly();
  }

  setCart(cart: Cart | null) { this._cart.set(cart); }
  loadCart() { return { subscribe: () => {} }; }
}

class MockWishlistService {
  readonly wishlistCount = computed(() => this._count());
  private _count = signal(0);

  setCount(n: number) { this._count.set(n); }
  loadWishlistIds() {}
  toggle() { return { subscribe: (handlers: { next?: (v: unknown) => void }) => handlers.next?.({}) }; }
}

class MockProductService {
  listAdvanced() { return { subscribe: () => {} }; }
  autocomplete() { return { subscribe: () => {} }; }
}

class MockNotificationService {
  readonly unreadCount = computed(() => this._unread());
  private _unread = signal(0);

  setUnread(n: number) { this._unread.set(n); }
  startPolling() {}
  stopPolling() {}
  getNotifications() { return { subscribe: () => {} }; }
  markRead() { return { subscribe: () => {} }; }
  markAllRead() { return { subscribe: () => {} }; }
  decrementUnread() {}
  resetUnread() {}
}

class MockThemeService {
  readonly effectiveTheme = signal<'light' | 'dark'>('light');
  toggle() {}
}

class MockTranslationService {
  readonly currentLang = signal('es');
  toggle() {}
}

class MockWebPushService {
  get isSupported() { return false; }
  get permission(): NotificationPermission { return 'default'; }
  isSubscribed() { return Promise.resolve(false); }
  subscribe() { return Promise.resolve('denied' as const); }
  unsubscribe() { return Promise.resolve(); }
}

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let mockAuth: MockAuthService;
  let mockCart: MockCartService;
  let mockWishlist: MockWishlistService;

  beforeEach(async () => {
    mockAuth = new MockAuthService();
    mockCart = new MockCartService();
    mockWishlist = new MockWishlistService();

    await TestBed.configureTestingModule({
      imports: [NavbarComponent, RouterTestingModule, TranslateModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: CartService, useValue: mockCart },
        { provide: ProductService, useValue: new MockProductService() },
        { provide: WishlistService, useValue: mockWishlist },
        { provide: NotificationService, useValue: new MockNotificationService() },
        { provide: ThemeService, useValue: new MockThemeService() },
        { provide: TranslationService, useValue: new MockTranslationService() },
        { provide: WebPushService, useValue: new MockWebPushService() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render logo link to home', () => {
    fixture.detectChanges();
    const logo = fixture.debugElement.query(By.css('.logo'));
    expect(logo.nativeElement.getAttribute('href')).toBe('/');
  });

  it('should show "Ingresar" button when not authenticated', () => {
    fixture.detectChanges();
    const loginBtn = fixture.debugElement.query(By.css('.btn-login'));
    expect(loginBtn).toBeTruthy();
    expect(loginBtn.nativeElement.textContent.trim()).toBe('Ingresar');
  });

  it('should show wishlist, cart, user menu when authenticated', () => {
    mockAuth.setAuth(true);
    mockAuth.setUser({ firstName: 'Ivan', lastName: 'S', email: 'a@b.com', role: 'USER' } as UserInfo);
    mockCart.setCart({ cartId: 1, items: [], totalAmount: 0, currencyCode: 'ARS' });
    mockWishlist.setCount(3);

    fixture.detectChanges();

    const wishlist = fixture.debugElement.query(By.css('.wishlist-btn'));
    const cart = fixture.debugElement.query(By.css('.cart-btn'));
    const userMenu = fixture.debugElement.query(By.css('.user-menu'));
    expect(wishlist).toBeTruthy();
    expect(cart).toBeTruthy();
    expect(userMenu).toBeTruthy();
  });

  it('should show wishlist badge with count', () => {
    mockAuth.setAuth(true);
    mockCart.setCart({ cartId: 1, items: [], totalAmount: 0, currencyCode: 'ARS' });
    mockWishlist.setCount(5);

    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.wishlist-badge'));
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('5');
  });

  it('should show cart badge with item count', () => {
    mockAuth.setAuth(true);
    const cart: Cart = {
      cartId: 1,
      items: [
        { cartItemId: 1, productVariantId: 1, productName: 'Test', productSlug: 'test', imageUrl: null, color: 'R', size: 'M', quantity: 3, unitPrice: 1000, currencyCode: 'ARS', customDesignId: null },
      ],
      totalAmount: 3000,
      currencyCode: 'ARS',
    };
    mockCart.setCart(cart);

    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.cart-badge'));
    expect(badge).toBeTruthy();
    expect(badge.nativeElement.textContent.trim()).toBe('3');
  });

  it('should cap cart badge at 9+', () => {
    mockAuth.setAuth(true);
    const cart: Cart = {
      cartId: 1,
      items: Array.from({ length: 15 }, (_, i) => ({
        cartItemId: i, productVariantId: i, productName: 'Test', productSlug: 'test', imageUrl: null as string | null, color: 'R', size: 'M', quantity: 1, unitPrice: 1000, currencyCode: 'ARS', customDesignId: null as number | null,
      })),
      totalAmount: 15000,
      currencyCode: 'ARS',
    };
    mockCart.setCart(cart);

    fixture.detectChanges();
    const badge = fixture.debugElement.query(By.css('.cart-badge'));
    expect(badge.nativeElement.textContent.trim()).toBe('9+');
  });

  it('should show user avatar with first initial', () => {
    mockAuth.setAuth(true);
    mockAuth.setUser({ firstName: 'Ana', lastName: 'P', email: 'a@b.com', role: 'USER' } as UserInfo);
    mockCart.setCart({ cartId: 1, items: [], totalAmount: 0, currencyCode: 'ARS' });

    fixture.detectChanges();
    const avatar = fixture.debugElement.query(By.css('.user-avatar'));
    expect(avatar).toBeTruthy();
    expect(avatar.nativeElement.textContent.trim()).toBe('A');
  });

  it('should show user name', () => {
    mockAuth.setAuth(true);
    mockAuth.setUser({ firstName: 'Carlos', lastName: 'M', email: 'c@m.com', role: 'USER' } as UserInfo);
    mockCart.setCart({ cartId: 1, items: [], totalAmount: 0, currencyCode: 'ARS' });

    fixture.detectChanges();
    const nameEl = fixture.debugElement.query(By.css('.user-name'));
    expect(nameEl).toBeTruthy();
    expect(nameEl.nativeElement.textContent.trim()).toBe('Carlos');
  });

  it('should call logout when logout is clicked', () => {
    spyOn(mockAuth, 'logout');
    mockAuth.setAuth(true);
    mockAuth.setUser({ firstName: 'T', lastName: 'T', email: 't@t.com', role: 'USER' } as UserInfo);
    mockCart.setCart({ cartId: 1, items: [], totalAmount: 0, currencyCode: 'ARS' });

    fixture.detectChanges();
    // Open dropdown
    const userMenu = fixture.debugElement.query(By.css('.user-menu'));
    userMenu.nativeElement.click();
    fixture.detectChanges();

    const logoutBtn = fixture.debugElement.query(By.css('.dropdown button:last-child'));
    logoutBtn.nativeElement.click();

    expect(mockAuth.logout).toHaveBeenCalled();
  });

  it('should have nav with aria-label for accessibility', () => {
    fixture.detectChanges();
    const nav = fixture.debugElement.query(By.css('nav'));
    expect(nav.nativeElement.getAttribute('aria-label')).toBe('Navegación principal');
  });

  it('should show search input', () => {
    fixture.detectChanges();
    const searchInput = fixture.debugElement.query(By.css('.search-input'));
    expect(searchInput).toBeTruthy();
  });

  it('should show catalog and sugerencias links', () => {
    fixture.detectChanges();
    const navLinks = fixture.debugElement.queryAll(By.css('.nav-links li a'));
    const hrefs = navLinks.map(a => a.nativeElement.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/sugerencias');
  });
});
