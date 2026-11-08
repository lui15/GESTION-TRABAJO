import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  HostBinding,
  HostListener,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

type RequestSource = 'tramo' | 'mudanzas360' | 'armamuebles' | 'obralocalmadrid' | string;

interface ClientRequest {
  id: string;
  source: RequestSource;
  name: string;
  phone: string;
  email: string | null;
  service: string | null;
  description: string | null;
  details: Record<string, unknown> | null;
  photos: string[] | null;
  created_at: string;
  reviewed_at: string | null;
}

type RequestFilter = 'pending' | 'reviewed' | 'all';

type ThemeMode = 'light' | 'dark' | 'auto';

type SortMode = 'newest' | 'oldest' | 'name';

interface RequestGroup {
  label: string;
  items: ClientRequest[];
}

const THEME_STORAGE_KEY = 'central-theme';
const ACCENT_STORAGE_KEY = 'central-accent';
const SORT_STORAGE_KEY = 'central-sort';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit, OnDestroy {
  // =====================================================
  // CONFIGURACIÓN DE SUPABASE
  // =====================================================

  private readonly SUPABASE_URL = 'https://obdetimymgchgqnlxbew.supabase.co';

  private readonly SUPABASE_ANON_KEY = 'sb_publishable_vGYxgkMKDNJr1G0aq7vBMQ_lLUQfJqn';

  private supabase!: SupabaseClient;

  private authSubscription: { unsubscribe: () => void } | null = null;

  private realtimeChannel: ReturnType<SupabaseClient['channel']> | null = null;

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  // =====================================================
  // ESTADO GENERAL
  // =====================================================

  user: User | null = null;

  loading = true;
  loadingRequests = false;
  submittingLogin = false;

  loginEmail = '';
  loginPassword = '';

  errorMessage = '';
  successMessage = '';

  requests: ClientRequest[] = [];

  selectedRequest: ClientRequest | null = null;

  // Estado de la ventana grande de detalle.
  closing = false;
  navDirection: '' | 'nav-next' | 'nav-prev' = '';

  activeFilter: RequestFilter = 'pending';

  activeSource = 'all';

  searchTerm = '';

  sidebarOpen = false;

  sortMode: SortMode = 'newest';

  // Selección múltiple
  selectionMode = false;
  selectedIds = new Set<string>();

  // Eliminación
  deleteTarget: string[] | null = null;
  deleting = false;
  deleteError = '';

  // =====================================================
  // APARIENCIA (modo claro / oscuro y color principal)
  // =====================================================

  readonly accentOptions = [
    { id: 'indigo', label: 'Índigo', color: '#4f46e5' },
    { id: 'blue', label: 'Azul', color: '#2563eb' },
    { id: 'teal', label: 'Turquesa', color: '#0d9488' },
    { id: 'green', label: 'Verde', color: '#16a34a' },
    { id: 'orange', label: 'Naranja', color: '#ea580c' },
    { id: 'rose', label: 'Rosa', color: '#e11d48' },
    { id: 'violet', label: 'Violeta', color: '#7c3aed' },
    { id: 'slate', label: 'Grafito', color: '#334155' },
  ];

  themeMode: ThemeMode = 'auto';
  accent = 'indigo';
  systemDark = false;
  themePanelOpen = false;

  private mediaQuery: MediaQueryList | null = null;

  private readonly mediaListener = (event: MediaQueryListEvent): void => {
    this.systemDark = event.matches;
    this.applyDocumentTheme();
    this.cdr.markForCheck();
  };

  get isDark(): boolean {
    return this.themeMode === 'dark' || (this.themeMode === 'auto' && this.systemDark);
  }

  @HostBinding('class')
  get hostClass(): string {
    return `accent-${this.accent}${this.isDark ? ' dark' : ''}`;
  }

  constructor(private cdr: ChangeDetectorRef) {}

  private initAppearance(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const storedTheme = this.readStorage(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'auto') {
      this.themeMode = storedTheme;
    }

    const storedAccent = this.readStorage(ACCENT_STORAGE_KEY);
    if (storedAccent && this.accentOptions.some((option) => option.id === storedAccent)) {
      this.accent = storedAccent;
    }

    const storedSort = this.readStorage(SORT_STORAGE_KEY);
    if (storedSort === 'newest' || storedSort === 'oldest' || storedSort === 'name') {
      this.sortMode = storedSort;
    }

    if (window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark = this.mediaQuery.matches;
      this.mediaQuery.addEventListener?.('change', this.mediaListener);
    }

    this.applyDocumentTheme();
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeMode = mode;
    this.writeStorage(THEME_STORAGE_KEY, mode);
    this.applyDocumentTheme();
  }

  /** Cambia directamente entre modo claro y oscuro. */
  toggleDarkMode(): void {
    this.setThemeMode(this.isDark ? 'light' : 'dark');
  }

  setAccent(accent: string): void {
    this.accent = accent;
    this.writeStorage(ACCENT_STORAGE_KEY, accent);
  }

  setSort(mode: SortMode): void {
    this.sortMode = mode;
    this.writeStorage(SORT_STORAGE_KEY, mode);
  }

  private applyDocumentTheme(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const dark = this.isDark;
    document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';

    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', dark ? '#0b0d12' : '#f4f5f9');
    });
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Almacenamiento no disponible (modo privado, etc.)
    }
  }

  // =====================================================
  // INICIALIZACIÓN
  // =====================================================

  async ngOnInit(): Promise<void> {
    this.initAppearance();

    if (this.SUPABASE_URL.includes('PEGA_AQUI') || this.SUPABASE_ANON_KEY.includes('PEGA_AQUI')) {
      this.errorMessage = 'Configura la URL y la clave pública de Supabase en app.ts.';

      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    try {
      this.supabase = createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);

      // Comprobar la sesión de usuario.
      const sessionPromise = this.supabase.auth.getSession();

      // Evitar que la comprobación de sesión
      // deje la aplicación cargando indefinidamente.
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT_SUPABASE'));
        }, 10000);
      });

      const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);

      if (error) {
        throw error;
      }

      this.user = data.session?.user ?? null;

      // Escuchar cambios de autenticación.
      this.authSubscription = this.supabase.auth.onAuthStateChange((event, session) => {
        // La sesión inicial ya se ha comprobado
        // mediante getSession().
        if (event === 'INITIAL_SESSION') {
          return;
        }

        const previousUserId = this.user?.id ?? null;

        this.user = session?.user ?? null;

        if (this.user) {
          // Solo recargar si ha cambiado el usuario
          // (evita recargas al volver a la pestaña
          // o al renovar el token).
          if (this.user.id !== previousUserId) {
            // IMPORTANTE: no llamar a Supabase directamente
            // dentro de este callback (puede bloquearse).
            setTimeout(() => {
              void this.loadRequests();

              this.subscribeToChanges();
            }, 0);
          }
        } else {
          this.requests = [];
          this.clearSelection();

          this.removeRealtimeSubscription();
        }

        this.cdr.markForCheck();
      }).data.subscription;
    } catch (error: any) {
      console.error('ERROR AL INICIAR LA CENTRAL:', error);

      this.errorMessage =
        error?.message === 'TIMEOUT_SUPABASE'
          ? 'Supabase está tardando demasiado en responder. Comprueba la conexión.'
          : this.getErrorMessage(error);
    } finally {
      // IMPORTANTE:
      // La pantalla inicial se cierra aunque la
      // consulta de solicitudes tarde más tiempo.
      this.loading = false;

      this.cdr.markForCheck();
    }

    // Cargar las solicitudes después de mostrar
    // la interfaz principal.
    if (this.user) {
      void this.loadRequests();

      this.subscribeToChanges();
    }
  }

  // =====================================================
  // DESTRUCCIÓN DEL COMPONENTE
  // =====================================================

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();

    this.removeRealtimeSubscription();

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }

    this.mediaQuery?.removeEventListener?.('change', this.mediaListener);

    this.lockScroll(false);
  }

  // =====================================================
  // TECLADO (ventana de detalle)
  // =====================================================

  /** Cierra el panel de colores al pulsar fuera de él. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.themePanelOpen) {
      return;
    }

    const target = event.target as Element | null;

    if (!target?.closest?.('.theme-picker')) {
      this.themePanelOpen = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.deleteTarget) {
      if (event.key === 'Escape') {
        this.cancelDelete();
      }
      return;
    }

    if (this.themePanelOpen && event.key === 'Escape') {
      this.themePanelOpen = false;
      return;
    }

    if (!this.selectedRequest) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeModal();
    } else if (event.key === 'ArrowRight') {
      this.goToAdjacent(1);
    } else if (event.key === 'ArrowLeft') {
      this.goToAdjacent(-1);
    }
  }

  // =====================================================
  // AUTENTICACIÓN
  // =====================================================

  async login(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.loginEmail.trim() || !this.loginPassword) {
      this.errorMessage = 'Introduce tu correo y contraseña.';

      return;
    }

    this.submittingLogin = true;

    try {
      const { error } = await this.supabase.auth.signInWithPassword({
        email: this.loginEmail.trim(),

        password: this.loginPassword,
      });

      if (error) {
        throw error;
      }

      this.loginPassword = '';

      this.showSuccess('Sesión iniciada correctamente.');
    } catch (error: any) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.submittingLogin = false;

      this.cdr.markForCheck();
    }
  }

  async logout(): Promise<void> {
    this.errorMessage = '';

    const { error } = await this.supabase.auth.signOut();

    if (error) {
      this.errorMessage = 'No se pudo cerrar la sesión.';

      this.cdr.markForCheck();

      return;
    }

    this.user = null;

    this.requests = [];

    this.clearSelection();

    this.removeRealtimeSubscription();

    this.cdr.markForCheck();
  }

  // =====================================================
  // CARGA DE SOLICITUDES
  // =====================================================

  async loadRequests(silent = false): Promise<void> {
    if (!this.user || !this.supabase) {
      return;
    }

    // En las recargas silenciosas (tiempo real) no se
    // muestra el indicador de carga.
    if (!silent) {
      this.loadingRequests = true;

      this.errorMessage = '';

      this.cdr.markForCheck();
    }

    try {
      const query = this.supabase.from('requests').select('*').order('created_at', {
        ascending: false,
      });

      // Evitar que una consulta colgada deje la
      // bandeja cargando para siempre.
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT_REQUESTS')), 15000);
      });

      const { data, error } = await Promise.race([query, timeout]);

      if (error) {
        throw error;
      }

      this.requests = (data ?? []) as ClientRequest[];

      // Quitar de la selección múltiple las que ya no existen.
      if (this.selectedIds.size) {
        const existing = new Set(this.requests.map((item) => item.id));
        this.selectedIds.forEach((id) => {
          if (!existing.has(id)) {
            this.selectedIds.delete(id);
          }
        });
      }

      // Mantener seleccionada la solicitud
      // si sigue existiendo.
      if (this.selectedRequest) {
        const current = this.requests.find((item) => item.id === this.selectedRequest?.id) ?? null;

        if (current) {
          this.selectedRequest = current;
        } else {
          this.clearSelection();
        }
      }
    } catch (error: any) {
      console.error('ERROR AL CARGAR SOLICITUDES:', error);

      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.loadingRequests = false;

      this.cdr.markForCheck();
    }
  }

  // =====================================================
  // ACTUALIZACIONES EN TIEMPO REAL
  // =====================================================

  private subscribeToChanges(): void {
    if (!this.supabase || !this.user) {
      return;
    }

    this.removeRealtimeSubscription();

    this.realtimeChannel = this.supabase
      .channel('central-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        () => {
          void this.loadRequests(true);
        },
      )
      .subscribe((status) => {
        console.log('Realtime:', status);
      });
  }

  private removeRealtimeSubscription(): void {
    if (this.realtimeChannel && this.supabase) {
      void this.supabase.removeChannel(this.realtimeChannel);

      this.realtimeChannel = null;
    }
  }

  // =====================================================
  // FILTROS Y BÚSQUEDA
  // =====================================================

  get filteredRequests(): ClientRequest[] {
    let result = [...this.requests];

    if (this.activeFilter === 'pending') {
      result = result.filter((request) => !request.reviewed_at);
    }

    if (this.activeFilter === 'reviewed') {
      result = result.filter((request) => !!request.reviewed_at);
    }

    if (this.activeSource !== 'all') {
      result = result.filter((request) => request.source === this.activeSource);
    }

    const term = this.searchTerm.trim().toLowerCase();

    if (term) {
      result = result.filter((request) => {
        const searchable = [
          request.name,
          request.phone,
          request.email,
          request.service,
          request.description,
          this.getSourceLabel(request.source),
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(term);
      });
    }

    // La consulta ya llega ordenada de más reciente a más antigua.
    if (this.sortMode === 'oldest') {
      result.reverse();
    } else if (this.sortMode === 'name') {
      result.sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }),
      );
    }

    return result;
  }

  /** Solicitudes agrupadas por fecha (o por inicial si se ordena por nombre). */
  get groupedRequests(): RequestGroup[] {
    const groups: RequestGroup[] = [];

    for (const request of this.filteredRequests) {
      const label =
        this.sortMode === 'name'
          ? (request.name || '#').trim().charAt(0).toUpperCase() || '#'
          : this.getDateGroup(request.created_at);

      let group = groups[groups.length - 1];

      if (!group || group.label !== label) {
        group = { label, items: [] };
        groups.push(group);
      }

      group.items.push(request);
    }

    return groups;
  }

  trackByLabel(_: number, group: RequestGroup): string {
    return group.label;
  }

  private getDateGroup(date: string): string {
    const created = new Date(date);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 86400000;
    const time = created.getTime();

    if (time >= startOfToday) {
      return 'Hoy';
    }

    if (time >= startOfToday - dayMs) {
      return 'Ayer';
    }

    if (time >= startOfToday - 6 * dayMs) {
      return 'Esta semana';
    }

    if (created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()) {
      return 'Este mes';
    }

    const label = created.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  setFilter(filter: RequestFilter): void {
    this.activeFilter = filter;

    this.selectedIds.clear();

    this.clearSelection();

    this.sidebarOpen = false;
  }

  setSource(source: string): void {
    this.activeSource = source;

    this.selectedIds.clear();

    this.clearSelection();

    this.sidebarOpen = false;
  }

  /**
   * Se usa al pulsar las tarjetas de resumen:
   * muestra esa sección completa y baja hasta la bandeja.
   */
  goToSection(filter: RequestFilter): void {
    this.activeFilter = filter;

    this.activeSource = 'all';

    this.searchTerm = '';

    this.clearSelection();

    this.sidebarOpen = false;

    setTimeout(() => {
      if (typeof document !== 'undefined') {
        document.getElementById('inbox')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 60);
  }

  // =====================================================
  // CONTADORES
  // =====================================================

  get pendingCount(): number {
    return this.requests.filter((request) => !request.reviewed_at).length;
  }

  get reviewedCount(): number {
    return this.requests.filter((request) => !!request.reviewed_at).length;
  }

  get totalCount(): number {
    return this.requests.length;
  }

  get tramoCount(): number {
    return this.requests.filter((request) => request.source === 'tramo').length;
  }

  get mudanzasCount(): number {
    return this.requests.filter((request) => request.source === 'mudanzas360').length;
  }

  get mueblesCount(): number {
    return this.requests.filter((request) => request.source === 'armamuebles').length;
  }

  get obrasCount(): number {
    return this.requests.filter((request) => request.source === 'obralocalmadrid').length;
  }

  // =====================================================
  // SELECCIÓN Y VENTANA DE DETALLE
  // =====================================================

  /** Lista de un solo elemento para repintar el contenido de la ventana al navegar. */
  get selectedList(): ClientRequest[] {
    return this.selectedRequest ? [this.selectedRequest] : [];
  }

  get selectedIndex(): number {
    if (!this.selectedRequest) {
      return -1;
    }

    return this.filteredRequests.findIndex((item) => item.id === this.selectedRequest?.id);
  }

  get canGoPrev(): boolean {
    return this.selectedIndex > 0;
  }

  get canGoNext(): boolean {
    const index = this.selectedIndex;

    return index >= 0 && index < this.filteredRequests.length - 1;
  }

  trackById(_: number, request: ClientRequest): string {
    return request.id;
  }

  getDelay(index: number): number {
    return Math.min(index, 12) * 45;
  }

  selectRequest(request: ClientRequest): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);

      this.closeTimer = null;
    }

    this.closing = false;

    this.navDirection = '';

    this.selectedRequest = request;

    this.errorMessage = '';

    this.sidebarOpen = false;

    this.lockScroll(true);
  }

  closeModal(): void {
    if (!this.selectedRequest || this.closing) {
      return;
    }

    this.closing = true;

    this.cdr.markForCheck();

    this.closeTimer = setTimeout(() => {
      this.clearSelection();

      this.closeTimer = null;

      this.cdr.markForCheck();
    }, 220);
  }

  goToAdjacent(direction: 1 | -1): void {
    const list = this.filteredRequests;

    const index = this.selectedIndex;

    if (index < 0) {
      return;
    }

    const next = list[index + direction];

    if (!next) {
      return;
    }

    this.navDirection = direction === 1 ? 'nav-next' : 'nav-prev';

    this.selectedRequest = next;

    this.cdr.markForCheck();
  }

  private clearSelection(): void {
    this.selectedRequest = null;

    this.closing = false;

    this.navDirection = '';

    this.lockScroll(false);
  }

  private lockScroll(locked: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = locked ? 'hidden' : '';
    }
  }

  // =====================================================
  // REVISIÓN
  // =====================================================

  async markAsReviewed(request: ClientRequest, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (request.reviewed_at) {
      return;
    }

    const reviewedAt = new Date().toISOString();

    const { error } = await this.supabase
      .from('requests')
      .update({
        reviewed_at: reviewedAt,
      })
      .eq('id', request.id);

    if (error) {
      this.errorMessage = 'No se pudo marcar la solicitud como revisada.';

      this.cdr.markForCheck();

      return;
    }

    this.requests = this.requests.map((item) =>
      item.id === request.id
        ? {
            ...item,
            reviewed_at: reviewedAt,
          }
        : item,
    );

    if (this.selectedRequest?.id === request.id) {
      this.selectedRequest = {
        ...this.selectedRequest,
        reviewed_at: reviewedAt,
      };
    }

    this.showSuccess('Solicitud marcada como revisada.');
  }

  async markAsPending(request: ClientRequest): Promise<void> {
    const { error } = await this.supabase
      .from('requests')
      .update({
        reviewed_at: null,
      })
      .eq('id', request.id);

    if (error) {
      this.errorMessage = 'No se pudo devolver la solicitud a pendientes.';

      this.cdr.markForCheck();

      return;
    }

    this.requests = this.requests.map((item) =>
      item.id === request.id
        ? {
            ...item,
            reviewed_at: null,
          }
        : item,
    );

    if (this.selectedRequest?.id === request.id) {
      this.selectedRequest = {
        ...this.selectedRequest,
        reviewed_at: null,
      };
    }

    this.showSuccess('Solicitud devuelta a pendientes.');
  }

  // =====================================================
  // SELECCIÓN MÚLTIPLE
  // =====================================================

  toggleSelectionMode(): void {
    this.selectionMode = !this.selectionMode;

    this.selectedIds.clear();
  }

  onCardClick(request: ClientRequest): void {
    if (this.selectionMode) {
      this.toggleSelected(request.id);
    } else {
      this.selectRequest(request);
    }
  }

  toggleSelected(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  get allVisibleSelected(): boolean {
    const visible = this.filteredRequests;

    return visible.length > 0 && visible.every((request) => this.selectedIds.has(request.id));
  }

  toggleSelectAll(): void {
    if (this.allVisibleSelected) {
      this.selectedIds.clear();
    } else {
      this.filteredRequests.forEach((request) => this.selectedIds.add(request.id));
    }
  }

  async markSelectedAsReviewed(): Promise<void> {
    const ids = this.requests
      .filter((request) => this.selectedIds.has(request.id) && !request.reviewed_at)
      .map((request) => request.id);

    if (!ids.length) {
      this.showSuccess('Las solicitudes seleccionadas ya estaban revisadas.');
      return;
    }

    const reviewedAt = new Date().toISOString();

    const { error } = await this.supabase
      .from('requests')
      .update({ reviewed_at: reviewedAt })
      .in('id', ids);

    if (error) {
      this.errorMessage = 'No se pudieron marcar las solicitudes como revisadas.';
      this.cdr.markForCheck();
      return;
    }

    const updated = new Set(ids);

    this.requests = this.requests.map((item) =>
      updated.has(item.id) ? { ...item, reviewed_at: reviewedAt } : item,
    );

    this.selectedIds.clear();
    this.selectionMode = false;

    this.showSuccess(
      ids.length === 1 ? 'Solicitud marcada como revisada.' : `${ids.length} solicitudes revisadas.`,
    );
  }

  // =====================================================
  // ELIMINACIÓN
  // =====================================================

  askDelete(ids: string[]): void {
    if (!ids.length) {
      return;
    }

    this.deleteError = '';
    this.deleteTarget = [...ids];
  }

  askDeleteSelected(): void {
    this.askDelete([...this.selectedIds]);
  }

  cancelDelete(): void {
    if (this.deleting) {
      return;
    }

    this.deleteTarget = null;
    this.deleteError = '';
  }

  get deleteTargetName(): string {
    if (!this.deleteTarget || this.deleteTarget.length !== 1) {
      return '';
    }

    const request = this.requests.find((item) => item.id === this.deleteTarget?.[0]);

    return request?.name || 'Cliente sin nombre';
  }

  async confirmDelete(): Promise<void> {
    const ids = this.deleteTarget;

    if (!ids?.length || this.deleting) {
      return;
    }

    this.deleting = true;
    this.deleteError = '';
    this.cdr.markForCheck();

    try {
      const { data, error } = await this.supabase
        .from('requests')
        .delete()
        .in('id', ids)
        .select('id');

      if (error) {
        throw error;
      }

      const deleted = new Set(((data ?? []) as { id: string }[]).map((row) => row.id));

      // Con RLS, si no hay permiso de borrado no da error: simplemente no borra nada.
      if (deleted.size === 0) {
        throw new Error('DELETE_BLOCKED');
      }

      this.requests = this.requests.filter((item) => !deleted.has(item.id));

      deleted.forEach((id) => this.selectedIds.delete(id));

      if (this.selectionMode && this.selectedIds.size === 0) {
        this.selectionMode = false;
      }

      if (this.selectedRequest && deleted.has(this.selectedRequest.id)) {
        this.clearSelection();
      }

      this.deleteTarget = null;

      if (deleted.size < ids.length) {
        this.errorMessage = 'Algunas solicitudes no se pudieron eliminar.';
      }

      this.showSuccess(
        deleted.size === 1 ? 'Solicitud eliminada.' : `${deleted.size} solicitudes eliminadas.`,
      );
    } catch (error: any) {
      console.error('ERROR AL ELIMINAR:', error);

      this.deleteError = this.getErrorMessage(error);
    } finally {
      this.deleting = false;
      this.cdr.markForCheck();
    }
  }

  // =====================================================
  // WHATSAPP
  // =====================================================

  getWhatsappUrl(phone: string | null | undefined): string {
    if (!phone) {
      return '';
    }

    let number = phone.replace(/\D/g, '');

    if (number.startsWith('00')) {
      number = number.substring(2);
    }

    if (number.startsWith('34') && number.length >= 11) {
      // Ya contiene el prefijo español.
    } else if (number.length === 9) {
      number = '34' + number;
    }

    return `https://wa.me/${number}`;
  }

  // =====================================================
  // INFORMACIÓN DE CADA WEB
  // =====================================================

  getSourceLabel(source: string): string {
    const sources: Record<string, string> = {
      tramo: 'Tramo (antiguo)',

      mudanzas360: 'Mudanzas360',

      armamuebles: 'ArmaMuebles',

      obralocalmadrid: 'ObraLocalMadrid',
    };

    return sources[source] ?? source ?? 'Web desconocida';
  }

  getSourceClass(source: string): string {
    const classes: Record<string, string> = {
      tramo: 'source-tramo',

      mudanzas360: 'source-mudanzas',

      armamuebles: 'source-muebles',

      obralocalmadrid: 'source-obras',
    };

    return classes[source] ?? 'source-default';
  }

  /** Clase de color (tema) de cada web, usada en tarjetas y ventana de detalle. */
  getSourceTheme(source: string): string {
    const themes: Record<string, string> = {
      tramo: 'theme-tramo',

      mudanzas360: 'theme-mudanzas',

      armamuebles: 'theme-muebles',

      obralocalmadrid: 'theme-obras',
    };

    return themes[source] ?? 'theme-default';
  }

  // =====================================================
  // INICIALES DEL CLIENTE
  // =====================================================

  getInitials(name: string | null | undefined): string {
    if (!name) {
      return 'CL';
    }

    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  // =====================================================
  // DETALLES ADICIONALES
  // =====================================================

  private readonly internalDetailKeys = ['is_test', 'test_batch'];

  getDetails(details: Record<string, unknown> | null): [string, unknown][] {
    if (!details || typeof details !== 'object') {
      return [];
    }

    return Object.entries(details).filter(
      ([key, value]) =>
        !this.internalDetailKeys.includes(key) &&
        value !== null &&
        value !== undefined &&
        value !== '',
    );
  }

  isTest(request: ClientRequest): boolean {
    return request.details?.['is_test'] === true;
  }

  formatDetailKey(key: string): string {
    const spaced = key
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim()
      .toLowerCase();

    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  formatDetailValue(value: unknown): string {
    if (typeof value === 'boolean') {
      return value ? 'Sí' : 'No';
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).join(', ');
    }

    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  // =====================================================
  // FECHAS
  // =====================================================

  formatFullDate(date: string | null | undefined): string {
    if (!date) {
      return '';
    }

    return new Date(date).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  timeAgo(date: string | null | undefined): string {
    if (!date) {
      return '';
    }

    const diffMs = Date.now() - new Date(date).getTime();

    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) {
      return 'Ahora mismo';
    }

    if (minutes < 60) {
      return `Hace ${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `Hace ${hours} h`;
    }

    const days = Math.floor(hours / 24);

    if (days < 7) {
      return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
    }

    return new Date(date).toLocaleDateString('es-ES');
  }

  shortId(id: string): string {
    return id ? id.substring(0, 8).toUpperCase() : '';
  }

  // =====================================================
  // MENSAJES Y UTILIDADES
  // =====================================================

  showSuccess(message: string): void {
    this.successMessage = message;

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      this.successMessage = '';

      this.toastTimer = null;

      this.cdr.markForCheck();
    }, 3500);

    this.cdr.markForCheck();
  }

  copyText(text: string | null | undefined, message: string): void {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then(() => this.showSuccess(message))
      .catch(() => {
        this.errorMessage = 'No se pudo copiar al portapapeles.';

        this.cdr.markForCheck();
      });
  }

  clearMessages(): void {
    this.errorMessage = '';

    this.successMessage = '';
  }

  private getErrorMessage(error: any): string {
    const message = error?.message ?? '';

    if (message === 'DELETE_BLOCKED') {
      return 'Supabase no ha permitido eliminar. Falta activar el permiso de borrado en la base de datos.';
    }

    if (message === 'TIMEOUT_REQUESTS') {
      return 'Las solicitudes tardan demasiado en cargar. Pulsa Actualizar o recarga la página.';
    }

    if (message.includes('Invalid login credentials')) {
      return 'Correo o contraseña incorrectos.';
    }

    if (message.includes('Failed to fetch')) {
      return 'No se pudo conectar. Comprueba tu conexión y la configuración de Supabase.';
    }

    if (message.includes('relation') || message.includes('does not exist')) {
      return 'No se encuentra la tabla requests. Comprueba que existe en Supabase.';
    }

    if (message.includes('permission denied') || message.includes('row-level security')) {
      return 'No tienes permisos para acceder a estos datos. Revisa las políticas de seguridad de Supabase.';
    }

    if (message.includes('JWT') || message.includes('Invalid API key')) {
      return 'La clave pública de Supabase no es válida. Comprueba la configuración.';
    }

    return message || 'Ha ocurrido un error inesperado.';
  }
}
