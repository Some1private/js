import { flags } from '@/entrypoint/utils/targets';
import { makeSourcerer } from '@/providers/base';
import { searchJackett } from './search';
import { addTorrentToRD, getRDStreamLinks } from './scrape';
import { MovieScrapeContext, ShowScrapeContext, SourcererOutput } from '../../../types/context';
import { NotFoundError } from '@/utils/errors';

export const realDebridScraper = makeSourcerer({
  id: 'realdebrid',
  name: 'Real-Debrid',
  rank: 200, // High rank due to quality of sources
  flags: [flags.CORS_ALLOWED],
  
  async scrapeMovie(ctx: MovieScrapeContext): Promise<SourcererOutput> {
    try {
      ctx.progress?.(10); // Starting search

      // Find best torrent match
      const jackettResult = await searchJackett(ctx, ctx.media);
      
      // Add to Real-Debrid
      const rdTorrent = await addTorrentToRD(ctx, jackettResult.MagnetUri);
      
      // Get streaming links
      const streamLinks = await getRDStreamLinks(ctx, rdTorrent.id);

      ctx.progress?.(100); // Complete

      return {
        stream: streamLinks.map(link => ({
          id: link.id.toString(),
          type: 'file',
          quality: link.quality,
          url: link.link,
          flags: [flags.CORS_ALLOWED],
        })),
        embeds: [], // Required by SourcererOutput type
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error(`Movie scraping failed: ${error.message}`);
    }
  },

  async scrapeShow(ctx: ShowScrapeContext): Promise<SourcererOutput> {
    try {
      ctx.progress?.(10); // Starting search

      // Search specifically for the episode
      const jackettResult = await searchJackett(ctx, ctx.media);
      
      // Add to Real-Debrid
      const rdTorrent = await addTorrentToRD(ctx, jackettResult.MagnetUri);
      
      // Get streaming links
      const streamLinks = await getRDStreamLinks(ctx, rdTorrent.id);

      ctx.progress?.(100); // Complete

      return {
        stream: streamLinks.map(link => ({
          id: link.id.toString(),
          type: 'file',
          quality: link.quality,
          url: link.link,
          flags: [flags.CORS_ALLOWED],
        })),
        embeds: [], // Required by SourcererOutput type
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error(`Show scraping failed: ${error.message}`);
    }
  },
}); 