import { SocialIcon } from 'react-social-icons';

const SUPPORTED_NETWORKS = new Set(['facebook', 'instagram', 'linkedin', 'youtube', 'twitter', 'x', 'tiktok']);

type SocialPlatformIconProps = {
  platform: string;
  url?: string;
  size?: number;
  fgColor?: string;
};

export default function SocialPlatformIcon({
  platform,
  url,
  size = 22,
  fgColor = '#ffffff',
}: SocialPlatformIconProps) {
  const network = platform === 'twitter' ? 'x' : platform;
  const fallbackUrl = url || `https://${platform}.com`;

  if (platform === 'website') {
    return (
      <span className="material-symbols-outlined" style={{ fontSize: size, color: fgColor }}>
        language
      </span>
    );
  }

  if (SUPPORTED_NETWORKS.has(network)) {
    return (
      <SocialIcon
        url={fallbackUrl}
        network={network}
        style={{ width: size, height: size }}
        fgColor={fgColor}
        bgColor="transparent"
      />
    );
  }

  return (
    <span className="material-symbols-outlined" style={{ fontSize: size, color: fgColor }}>
      link
    </span>
  );
}
