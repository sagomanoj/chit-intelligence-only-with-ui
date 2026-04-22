import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';

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
      if (Capacitor.getPlatform() === 'ios') {
        adId = 'ca-app-pub-3940256099942544/2934735716';
      } else if (Capacitor.getPlatform() === 'android') {
        adId = 'ca-app-pub-1256592546820339/3969248365';
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
      }
    }
  }
}
