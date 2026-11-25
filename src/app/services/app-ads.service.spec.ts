import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppAdsService } from './app-ads.service';

const AdMob = vi.hoisted(() => ({
  prepareInterstitial: vi.fn<() => Promise<void>>(),
  showInterstitial: vi.fn<() => Promise<void>>(),
  addListener: vi.fn<(event: string, callback: () => void) => Promise<{ remove: () => Promise<void> }>>()
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));
vi.mock('@capacitor-community/admob', () => ({
  InterstitialAdPluginEvents: { Dismissed: 'dismissed', FailedToShow: 'failed' },
  AdMob
}));

describe('Interstitials at cycle saves', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('does not request ads before consent allows them', async () => {
    const ads = new AppAdsService();
    await ads.prepareInterstitial();
    await ads.showInterstitialAtNaturalBreak();
    expect(AdMob.prepareInterstitial).not.toHaveBeenCalled();
    expect(AdMob.showInterstitial).not.toHaveBeenCalled();
  });

  it('recovers from an unfilled request and shows the loaded ad only at a later save', async () => {
    AdMob.prepareInterstitial.mockRejectedValueOnce(new Error('No fill'));
    const ads = new AppAdsService();
    ads.setConsent(true);
    await Promise.resolve();
    await ads.showInterstitialAtNaturalBreak();
    expect(AdMob.prepareInterstitial).toHaveBeenCalledTimes(2);
    expect(AdMob.showInterstitial).not.toHaveBeenCalled();

    let dismiss!: () => void;
    AdMob.addListener.mockImplementation(async (event, callback) => {
      if (event === 'dismissed') dismiss = callback;
      return { remove: async () => {} };
    });
    AdMob.showInterstitial.mockImplementation(async () => { dismiss(); });
    await ads.showInterstitialAtNaturalBreak();
    expect(AdMob.showInterstitial).toHaveBeenCalledOnce();
    expect(AdMob.prepareInterstitial).toHaveBeenCalledTimes(3);
  });
});
