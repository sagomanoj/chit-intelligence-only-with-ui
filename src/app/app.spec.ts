import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdMob } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { App, getAdConfiguration } from './app';

vi.mock('@capacitor-community/admob', async importOriginal => {
  const actual = await importOriginal<typeof import('@capacitor-community/admob')>();
  return {
    ...actual,
    AdMob: {
      initialize: vi.fn(),
      showBanner: vi.fn(),
      hideBanner: vi.fn(),
      resumeBanner: vi.fn(),
      prepareInterstitial: vi.fn(),
      showInterstitial: vi.fn()
    }
  };
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('marks the Google iOS test ad units as testing', () => {
    expect(getAdConfiguration('ios')).toEqual({
      bannerAdId: 'ca-app-pub-3940256099942544/2934735716',
      interstitialAdId: 'ca-app-pub-3940256099942544/4411468910',
      isTesting: true
    });
  });

  it('keeps the configured Android ad units in production mode', () => {
    expect(getAdConfiguration('android')).toEqual({
      bannerAdId: 'ca-app-pub-1256592546820339/3969248365',
      interstitialAdId: 'ca-app-pub-1256592546820339/9301409597',
      isTesting: false
    });
  });

  it('handles AdMob initialization failures without continuing ad setup', async () => {
    const initializationError = new Error('AdMob unavailable');
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    const initializeSpy = vi.mocked(AdMob.initialize).mockRejectedValueOnce(initializationError);
    const showBannerSpy = vi.mocked(AdMob.showBanner);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(App);

    await expect(fixture.componentInstance.ngOnInit()).resolves.toBeUndefined();

    expect(initializeSpy).toHaveBeenCalledWith({ initializeForTesting: false });
    expect(showBannerSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize AdMob', initializationError);
  });
});
