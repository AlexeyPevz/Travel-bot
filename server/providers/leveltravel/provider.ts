import { BaseProvider } from '../base/provider';
import { ProviderType } from '../base/types';
import { fetchToursFromLevelTravel } from '../leveltravel';

export class LevelTravelProvider extends BaseProvider<any, any> {
  readonly name = 'leveltravel';
  readonly type = ProviderType.TOURS;
  readonly priority = 10;

  async search(params: any): Promise<any[]> {
    return fetchToursFromLevelTravel(params);
  }

  async getDetails(id: string): Promise<any> {
    throw new Error('getDetails not implemented for LevelTravelProvider');
  }
}