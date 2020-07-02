import Base from '../../common/models/base';
import { StorageRef } from '../registries/registry';
import { ModuleTypes } from '../../common/constants';
import { Environments } from '../../common/types';

export default class VersionInfo extends Base {
    getId = () => this.dist.hash;

    type: ModuleTypes = null;
    name: string = null;
    branch: string = null;
    version: string = null;
    dist: StorageRef = null;
    dependencies: {
        [name: string]: string
    } = null;
    interfaces: {
        [name: string]: string
    } = null;
    environment?: Environments = null;
}