import { Component, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Keyboard } from '@capacitor/keyboard';

export interface AdConfiguration {
  bannerAdId: string;
  interstitialAdId: string;
  isTesting: boolean;
}

export function getAdConfiguration(platform: string): AdConfiguration | undefined {
  if (platform === 'ios') {
    return {
      bannerAdId: 'ca-app-pub-3940256099942544/2934735716',
      interstitialAdId: 'ca-app-pub-3940256099942544/4411468910',
      isTesting: true
    };
  }

  if (platform === 'android') {
    return {
      bannerAdId: 'ca-app-pub-1256592546820339/3969248365',
      interstitialAdId: 'ca-app-pub-1256592546820339/9301409597',
      isTesting: false
    };
  }

  return undefined;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('ChitIntelligenceFrontend');

  async ngOnInit(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const adConfiguration = getAdConfiguration(Capacitor.getPlatform());
    if (!adConfiguration) {
      return;
    }

    try {
      await AdMob.initialize({
        initializeForTesting: adConfiguration.isTesting
      });
    } catch (error) {
      console.error('Failed to initialize AdMob', error);
      return;
    }

    try {
      const options: BannerAdOptions = {
        adId: adConfiguration.bannerAdId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: adConfiguration.isTesting
      };
      await AdMob.showBanner(options);

      // Hide banner when keyboard is open to prevent it from covering inputs.
      await Keyboard.addListener('keyboardWillShow', () => {
        AdMob.hideBanner().catch(error => console.error('Failed to hide banner ad', error));
      });
      await Keyboard.addListener('keyboardWillHide', () => {
        AdMob.resumeBanner().catch(error => console.error('Failed to resume banner ad', error));
      });
    } catch (error) {
      console.error('Failed to configure banner ad', error);
    }

    // Show video/interstitial ad every 2 minutes (120,000 ms).
    setInterval(async () => {
      try {
        await AdMob.prepareInterstitial({
          adId: adConfiguration.interstitialAdId,
          isTesting: adConfiguration.isTesting
        });
        await AdMob.showInterstitial();
      } catch (error) {
        console.error('Failed to show interstitial ad', error);
      }
    }, 120000);
  }
}
