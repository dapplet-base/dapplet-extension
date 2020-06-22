import Base from '../../common/models/base';
import { WalletInfo } from '../../common/constants';

export class GlobalConfig extends Base {
    getId = () => this.id;

    id: string = 'default';

    suspended: boolean = false;

    walletInfo: WalletInfo = null;

    registries: { url: string, isDev: boolean }[] = [];

    intro = {
        popupDeveloperWelcome: true
    };

    devMode: boolean = false;

    trustedUsers: { account: string }[] = [];

    userSettings: {
        [moduleName: string]: { [key: string]: any }
    } = {};
}