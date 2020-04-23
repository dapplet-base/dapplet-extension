import CID from "cids";

export interface Storage {
    getResource(cid: CID): Promise<ArrayBuffer>;
}