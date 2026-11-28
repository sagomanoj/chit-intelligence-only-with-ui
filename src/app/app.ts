import { ChangeDetectorRef, Component, inject, signal, OnInit, OnDestroy, isDevMode } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { App as NativeApp } from '@capacitor/app';
import { FormsModule } from '@angular/forms';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AdMob, BannerAdPluginEvents, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus, AppUpdateInfo } from '@capawesome/capacitor-app-update';
import { Keyboard } from '@capacitor/keyboard';
import { ChitService } from './services/chit.service';
import { AppAdsService } from './services/app-ads.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('ChitIntelligenceFrontend');
  private keyboardShowHandle: PluginListenerHandle | null = null;
  private bannerSizeHandle: PluginListenerHandle | null = null;
  private keyboardHideHandle: PluginListenerHandle | null = null;
  private appUpdateListener: PluginListenerHandle | null = null;
  private appUpdateInfo: AppUpdateInfo | null = null;
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private backListener?: Promise<PluginListenerHandle>;

  showSettingsModal = false;
  showAdPrivacyOptions = false;
  showUpdateBanner = false;
  updateAvailableVersion: string | null = null;
  updateDownloaded = false;
  updateBusy = false;
  updateMessage: string | null = null;
  readonly importSuccess = signal<string | null>(null);
  readonly importError = signal<string | null>(null);

  constructor(private chitService: ChitService, private appAds: AppAdsService, private router: Router) {}

  get inChitCalculator(): boolean {
    return this.router.url.split(/[?#]/, 1)[0].endsWith('/auction');
  }

  openSettings(): void {
    this.importSuccess.set(null);
    this.importError.set(null);
    this.showSettingsModal = true;
  }

  closeSettings(): void {
    this.showSettingsModal = false;
  }

  exportData(): void {
    const jsonStr = this.chitService.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chit_intelligence_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.importError.set(null);
    this.importSuccess.set('Backup download started.');
    setTimeout(() => this.importSuccess.set(null), 4000);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const success = this.chitService.importData(content);
          if (success) {
            this.importSuccess.set('Your backup was restored.');
            this.importError.set(null);
            setTimeout(() => this.importSuccess.set(null), 4000);
          }
        } catch {
          this.importError.set('This backup file can’t be read. Choose a backup saved from Chit Intelligence.');
          this.importSuccess.set(null);
        }
      };
      reader.onerror = () => {
        this.importError.set('Couldn’t open this file. Choose it again or try another backup.');
        this.importSuccess.set(null);
      };
      reader.readAsText(file);
    }
  }

  async ngOnInit() {
    if (Capacitor.getPlatform() === 'android') {
      this.backListener = NativeApp.addListener('backButton', ({ canGoBack }) => this.androidBack(canGoBack));
      try {
        this.appUpdateListener = await AppUpdate.addListener('onFlexibleUpdateStateChange', state => {
          if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
            this.updateDownloaded = true;
            this.showUpdateBanner = true;
            this.updateMessage = 'Update downloaded. Restart the app to finish installing it.';
          }
        });
        void this.checkForAppUpdate();
      } catch (error) {
        console.warn('In-app update check is unavailable in this install:', error);
      }
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await AdMob.initialize({
          initializeForTesting: isDevMode()
        });

        const platform = Capacitor.getPlatform();
        if (platform === 'ios' && !isDevMode()) return;
        const adId = platform === 'android'
          ? (isDevMode() ? 'ca-app-pub-3940256099942544/9214589741' : 'ca-app-pub-1256592546820339/3969248365')
          : platform === 'ios'
            ? 'ca-app-pub-3940256099942544/2435281174'
            : '';

        if (adId) {
          let consentInfo = await AdMob.requestConsentInfo();
          if (!consentInfo.canRequestAds && consentInfo.isConsentFormAvailable) {
            consentInfo = await AdMob.showConsentForm();
          }
          this.showAdPrivacyOptions = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED';

          this.appAds.setConsent(consentInfo.canRequestAds);
          if (consentInfo.canRequestAds) {
            const options: BannerAdOptions = {
              adId,
              adSize: BannerAdSize.ADAPTIVE_BANNER,
              position: BannerAdPosition.BOTTOM_CENTER,
              margin: 0,
              isTesting: isDevMode()
            };
            this.bannerSizeHandle = await AdMob.addListener(BannerAdPluginEvents.SizeChanged, size => {
              document.documentElement.style.setProperty('--ad-height', Math.max(0, size.height) + 'px');
              document.documentElement.classList.toggle('android-banner-visible', platform === 'android' && size.height > 0);
            });
            await AdMob.showBanner(options);

            this.keyboardShowHandle = await Keyboard.addListener('keyboardWillShow', () => {
              AdMob.hideBanner().catch(console.error);
            });
            this.keyboardHideHandle = await Keyboard.addListener('keyboardWillHide', () => {
              AdMob.resumeBanner().catch(console.error);
            });
          }
        }
      } catch (e) {
        console.error('AdMob initialization error:', e);
      }
    }
  }

  androidBack(canGoBack: boolean): void {
    const sheets = this.document.querySelectorAll('dialog[appSheet][open]');
    const sheet = sheets.item(sheets.length - 1);
    if (sheet) {
      // Use the same cancel action as Escape so the component also clears its open state.
      sheet.dispatchEvent(new Event('cancel', { cancelable: true }));
      return;
    }
    if (this.showSettingsModal) {
      this.closeSettings();
      this.changeDetector.markForCheck();
      return;
    }
    if (canGoBack) {
      this.location.back();
      return;
    }

    // A restored or directly opened screen can be the first entry in WebView history.
    const route = this.router.routerState.snapshot.root.firstChild;
    const path = route?.routeConfig?.path;
    if (route && (path === 'chits/:id/edit' || path === 'chits/:id/auction')) {
      void this.router.navigate(['/chits', route.paramMap.get('id')], { replaceUrl: true });
    } else if (path === 'chits/:id' || path === 'chits/create') {
      void this.router.navigate(['/chits'], { replaceUrl: true });
    } else if (path && path !== 'dashboard') {
      void this.router.navigate(['/dashboard'], { replaceUrl: true });
    } else {
      void NativeApp.minimizeApp();
    }
  }

  async checkForAppUpdate(manual = false): Promise<void> {
    if (Capacitor.getPlatform() !== 'android') {
      if (manual) this.updateMessage = 'Google Play app updates are available in the Android app.';
      return;
    }
    if (manual) this.updateMessage = 'Checking Google Play for an update…';

    try {
      const info = await AppUpdate.getAppUpdateInfo();
      this.appUpdateInfo = info;
      this.updateDownloaded = info.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED;
      this.updateAvailableVersion = info.availableVersionCode ?? null;
      this.showUpdateBanner = info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE
        || info.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS;
      if (this.updateDownloaded) this.showUpdateBanner = true;

      if (manual) {
        this.updateMessage = this.showUpdateBanner
          ? 'An update is available on Google Play.'
          : 'No update was found. This may also happen when the app was installed outside Google Play.';
      }
    } catch (error) {
      if (manual) this.updateMessage = 'Could not check Google Play right now. Try again when the Play Store is available.';
      console.warn('Google Play update check failed:', error);
    }
  }

  async installAppUpdate(): Promise<void> {
    if (this.updateBusy) return;
    this.updateBusy = true;
    try {
      if (this.updateDownloaded) {
        await AppUpdate.completeFlexibleUpdate();
        return;
      }

      const info = this.appUpdateInfo ?? await AppUpdate.getAppUpdateInfo();
      this.appUpdateInfo = info;
      if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) {
        await this.checkForAppUpdate(true);
        return;
      }

      if (info.flexibleUpdateAllowed) {
        await AppUpdate.startFlexibleUpdate();
        this.updateMessage = 'The update is downloading in the background.';
      } else {
        await AppUpdate.openAppStore({ androidPackageName: 'com.sagomanoj.chitintelligence' });
      }
    } catch (error) {
      this.updateMessage = 'The update could not be started. Open Google Play and update Chit Intelligence there.';
      console.warn('Unable to start Google Play update:', error);
    } finally {
      this.updateBusy = false;
    }
  }

  dismissUpdateBanner(): void {
    this.showUpdateBanner = false;
  }

  async openAdPrivacyOptions(): Promise<void> {
    this.appAds.setConsent(false);
    try {
      await AdMob.showPrivacyOptionsForm();
    } catch (error) {
      console.error('Unable to open ad privacy options:', error);
    }
    try {
      this.appAds.setConsent((await AdMob.requestConsentInfo()).canRequestAds);
    } catch (error) {
      console.warn('Could not refresh ad consent:', error);
    }
  }

  ngOnDestroy(): void {
    void this.backListener?.then(listener => listener.remove());
    void this.bannerSizeHandle?.remove();
    document.documentElement.style.removeProperty('--ad-height');
    document.documentElement.classList.remove('android-banner-visible');
    if (this.keyboardShowHandle) {
      this.keyboardShowHandle.remove();
    }
    if (this.keyboardHideHandle) {
      this.keyboardHideHandle.remove();
    }
    if (this.appUpdateListener) {
      void this.appUpdateListener.remove();
    }
  }
}
