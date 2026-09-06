import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Keyboard } from '@capacitor/keyboard';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('ChitIntelligenceFrontend');
  private keyboardShowHandle: PluginListenerHandle | null = null;
  private keyboardHideHandle: PluginListenerHandle | null = null;

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
