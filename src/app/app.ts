import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Keyboard } from '@capacitor/keyboard';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('ChitIntelligenceFrontend');

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      await AdMob.initialize({
        initializeForTesting: false
      });

      let adId = '';
      let interstitialAdId = '';
      if (Capacitor.getPlatform() === 'ios') {
        adId = 'ca-app-pub-3940256099942544/2934735716';
        interstitialAdId = 'ca-app-pub-3940256099942544/4411468910'; // Google Test ID for iOS
      } else if (Capacitor.getPlatform() === 'android') {
        adId = 'ca-app-pub-1256592546820339/3969248365';
        interstitialAdId = 'ca-app-pub-3940256099942544/1033173712'; // Google Test ID for Android
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

        // Hide banner when keyboard is open to prevent it from covering inputs
        Keyboard.addListener('keyboardWillShow', () => {
          AdMob.hideBanner().catch(console.error);
        });
        Keyboard.addListener('keyboardWillHide', () => {
          AdMob.resumeBanner().catch(console.error);
        });
      }

      if (interstitialAdId) {
        // Show video/interstitial ad after 2 minutes (120,000 ms)
        setTimeout(async () => {
          try {
            await AdMob.prepareInterstitial({
              adId: interstitialAdId,
              isTesting: true // Enforce test mode for default Google IDs
            });
            await AdMob.showInterstitial();
          } catch (e) {
            console.error('Failed to show interstitial ad', e);
          }
        }, 120000);
      }
    }
  }
}
