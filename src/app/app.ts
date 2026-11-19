import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Keyboard } from '@capacitor/keyboard';
import { ChitService } from './services/chit.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('ChitIntelligenceFrontend');
  private keyboardShowHandle: PluginListenerHandle | null = null;
  private keyboardHideHandle: PluginListenerHandle | null = null;

  showSettingsModal = false;
  importSuccess: string | null = null;
  importError: string | null = null;

  constructor(private chitService: ChitService) {}

  openSettings(): void {
    this.importSuccess = null;
    this.importError = null;
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
    this.importSuccess = 'Backup JSON downloaded successfully!';
    setTimeout(() => this.importSuccess = null, 4000);
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
            this.importSuccess = 'Data successfully imported from backup file!';
            this.importError = null;
            setTimeout(() => this.importSuccess = null, 4000);
          }
        } catch (err: any) {
          this.importError = err.message || 'Failed to import JSON file. Please check file structure.';
          this.importSuccess = null;
        }
      };
      reader.readAsText(file);
    }
  }

  resetSampleData(): void {
    if (confirm('Are you sure you want to reset all data back to original sample records? All custom chits will be replaced.')) {
      this.chitService.resetToSampleData();
      this.importSuccess = 'Data has been reset to default sample records.';
      setTimeout(() => {
        this.importSuccess = null;
        this.closeSettings();
        window.location.reload();
      }, 1500);
    }
  }

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      try {
        await AdMob.initialize({
          initializeForTesting: false
        });

        let adId = '';
        let interstitialAdId = '';
        if (Capacitor.getPlatform() === 'ios') {
          adId = 'ca-app-pub-3940256099942544/2934735716';
          interstitialAdId = 'ca-app-pub-3940256099942544/4411468910';
        } else if (Capacitor.getPlatform() === 'android') {
          adId = 'ca-app-pub-1256592546820339/3969248365';
          interstitialAdId = 'ca-app-pub-3940256099942544/1033173712';
        }

        if (adId) {
          const options: BannerAdOptions = {
            adId: adId,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
            isTesting: false
          };
          await AdMob.showBanner(options);

          this.keyboardShowHandle = await Keyboard.addListener('keyboardWillShow', () => {
            AdMob.hideBanner().catch(console.error);
          });
          this.keyboardHideHandle = await Keyboard.addListener('keyboardWillHide', () => {
            AdMob.resumeBanner().catch(console.error);
          });
        }

        if (interstitialAdId) {
          setTimeout(async () => {
            try {
              await AdMob.prepareInterstitial({
                adId: interstitialAdId,
                isTesting: true
              });
              await AdMob.showInterstitial();
            } catch (e) {
              console.error('Failed to show interstitial ad', e);
            }
          }, 120000);
        }
      } catch (e) {
        console.error('AdMob initialization error:', e);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.keyboardShowHandle) {
      this.keyboardShowHandle.remove();
    }
    if (this.keyboardHideHandle) {
      this.keyboardHideHandle.remove();
    }
  }
}
