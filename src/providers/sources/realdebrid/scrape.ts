import { Context } from '../../../types/context';
import { RealDebridStream, RealDebridTorrent } from './types';
import { NotFoundError } from '@/utils/errors';

const RD_API_URL = 'https://api.real-debrid.com/rest/1.0';
const RD_API_TOKEN = process.env.REAL_DEBRID_API_TOKEN || '';

interface RDError {
  error: string;
  error_code?: number;
}

const QUALITY_MAP: Record<string, string> = {
  '2160p': '4K',
  '1080p': 'FHD',
  '720p': 'HD',
  '480p': 'SD',
  '360p': 'LD'
};

function validateApiToken() {
  if (!RD_API_TOKEN) {
    throw new Error('Real-Debrid API token is not configured. Please set REAL_DEBRID_API_TOKEN environment variable.');
  }
}

export async function addTorrentToRD(ctx: Context, magnetUrl: string): Promise<RealDebridTorrent> {
  try {
    validateApiToken();
    
    console.log('[RealDebrid] Adding magnet URL to Real-Debrid...');
    const response = await ctx.proxiedFetch(`${RD_API_URL}/torrents/addMagnet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RD_API_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ magnet: magnetUrl }),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('[RealDebrid] Failed to add torrent:', responseData);
      throw new Error(`Failed to add torrent to Real-Debrid: ${responseData.error || 'Unknown error'} (code: ${responseData.error_code || 'unknown'})`);
    }

    console.log('[RealDebrid] Torrent added successfully:', responseData.id);
    const torrent = responseData;

    // Select all files by default
    console.log('[RealDebrid] Selecting all files for torrent:', torrent.id);
    const selectResponse = await ctx.proxiedFetch(`${RD_API_URL}/torrents/selectFiles/${torrent.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RD_API_TOKEN}`,
      },
      body: new URLSearchParams({ all: '1' }),
    });

    const selectData = await selectResponse.json();
    
    if (!selectResponse.ok) {
      console.error('[RealDebrid] Failed to select files:', selectData);
      throw new Error(`Failed to select files: ${selectData.error || 'Unknown error'} (code: ${selectData.error_code || 'unknown'})`);
    }

    ctx.progress?.(60);
    return torrent;
  } catch (error) {
    console.error('[RealDebrid] Error in addTorrentToRD:', error);
    throw error;
  }
}

export async function getRDStreamLinks(ctx: Context, torrentId: string): Promise<RealDebridStream[]> {
  try {
    validateApiToken();
    
    console.log('[RealDebrid] Checking torrent status:', torrentId);
    const statusResponse = await ctx.proxiedFetch(`${RD_API_URL}/torrents/info/${torrentId}`, {
      headers: {
        'Authorization': `Bearer ${RD_API_TOKEN}`,
      },
    });

    const torrentInfo = await statusResponse.json();
    
    if (!statusResponse.ok) {
      console.error('[RealDebrid] Failed to get torrent status:', torrentInfo);
      throw new Error(`Failed to get torrent status: ${torrentInfo.error || 'Unknown error'} (code: ${torrentInfo.error_code || 'unknown'})`);
    }

    console.log('[RealDebrid] Torrent status:', torrentInfo.status);
    
    // Wait for torrent to be ready
    if (torrentInfo.status !== 'downloaded') {
      throw new Error(`Torrent not ready. Current status: ${torrentInfo.status}`);
    }

    // Get unrestricted links
    const streams: RealDebridStream[] = [];
    console.log('[RealDebrid] Processing', torrentInfo.links?.length || 0, 'links');
    
    for (const link of torrentInfo.links || []) {
      console.log('[RealDebrid] Unrestricting link...');
      const unrestrictResponse = await ctx.proxiedFetch(`${RD_API_URL}/unrestrict/link`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RD_API_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ link }),
      });

      if (unrestrictResponse.ok) {
        const streamData = await unrestrictResponse.json();
        console.log('[RealDebrid] Successfully unrestricted link:', streamData.filename);
        streams.push({
          id: streams.length + 1,
          filename: streamData.filename,
          mimeType: streamData.mimeType,
          filesize: streamData.filesize,
          link: streamData.download,
          host: streamData.host,
          quality: getQualityFromFilename(streamData.filename),
        });
      } else {
        console.error('[RealDebrid] Failed to unrestrict link:', await unrestrictResponse.json());
      }
    }

    if (streams.length === 0) {
      console.error('[RealDebrid] No valid streams found');
      throw new NotFoundError('No valid streams found');
    }

    console.log('[RealDebrid] Found', streams.length, 'valid streams');
    
    // Sort streams by quality and size
    streams.sort((a, b) => {
      const qualityA = getQualityValue(a.quality);
      const qualityB = getQualityValue(b.quality);
      if (qualityA !== qualityB) return qualityB - qualityA;
      return b.filesize - a.filesize;
    });

    ctx.progress?.(90);
    return streams;
  } catch (error) {
    console.error('[RealDebrid] Error in getRDStreamLinks:', error);
    if (error instanceof NotFoundError) throw error;
    throw error;
  }
}

function getQualityFromFilename(filename: string): string {
  // First check for standard quality markers
  for (const [quality, label] of Object.entries(QUALITY_MAP)) {
    if (filename.toLowerCase().includes(quality.toLowerCase())) {
      return label;
    }
  }

  // Check for additional quality indicators
  if (filename.toLowerCase().includes('4k') || filename.toLowerCase().includes('uhd')) {
    return '4K';
  }

  return 'unknown';
}

function getQualityValue(quality: string): number {
  const qualityValues: Record<string, number> = {
    '4K': 4,
    'FHD': 3,
    'HD': 2,
    'SD': 1,
    'LD': 0,
    'unknown': -1
  };
  return qualityValues[quality] ?? -1;
} 