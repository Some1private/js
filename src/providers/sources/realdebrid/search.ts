import { Context } from '../../../types/context';
import { MovieMedia, ShowMedia } from '../../../types/media';
import { JackettResult } from './types';
import { NotFoundError } from '@/utils/errors';

const JACKETT_API_URL = 'https://streaming-search-7exwrv-ba5003-95-216-210-58.traefik.me';
const JACKETT_API_KEY = 'vs1zfeajynbkrcie6l9ztmol4v7u0jfr';

// Categories based on Jackett standards
const MOVIE_CATEGORIES = '2000,2010,2020,2030,2040,2045,2050,2060';
const TV_CATEGORIES = '5000,5020,5030,5040,5045,5050,5060';

export async function searchJackett(ctx: Context, media: MovieMedia | ShowMedia): Promise<JackettResult> {
  // Build search parameters
  const params = new URLSearchParams({
    apikey: JACKETT_API_KEY,
  });

  if (media.type === 'movie') {
    params.append('t', 'movie');
    params.append('cat', MOVIE_CATEGORIES);
    if (media.imdbId) {
      params.append('imdbid', media.imdbId);
    } else {
      params.append('q', `${media.title} ${media.year}`);
    }
  } else {
    params.append('t', 'tvsearch');
    params.append('cat', TV_CATEGORIES);
    if (media.imdbId) {
      params.append('imdbid', media.imdbId);
    } else {
      params.append('q', media.title);
    }
    params.append('season', media.season.toString());
    params.append('ep', media.episode.toString());
  }

  try {
    const response = await ctx.proxiedFetch(`${JACKETT_API_URL}/api/v2.0/indexers/all/results/torznab`, {
      params,
    });

    if (!response.ok) {
      throw new Error(`Jackett API error: ${response.status} ${response.statusText}`);
    }

    const results: JackettResult[] = await response.json();
    
    // Filter and sort results by seeders and size
    const validResults = results
      .filter(result => result.Seeders > 0)
      .sort((a, b) => {
        // Prioritize by seeders
        const seederDiff = b.Seeders - a.Seeders;
        if (seederDiff !== 0) return seederDiff;
        
        // Then by size (prefer larger files for better quality)
        return b.Size - a.Size;
      });

    if (validResults.length === 0) {
      throw new NotFoundError('No valid torrents found');
    }

    ctx.progress?.(30); // Update progress after search
    return validResults[0];
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new Error(`Failed to search Jackett: ${error.message}`);
  }
} 