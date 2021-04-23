import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {debounceTime} from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(
    private ref: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private httpClient: HttpClient
  ) {
  }

  explorerQuery = '';
  explorerResponse = null;
  queryNode = '';
  errorStr = ('Please enter a valid DeSo public key, transaction ID, block ' +
    'hash, or block height. Public keys start with "BC", transaction IDs ' +
    'start with "3J", and block hashes usually start with zeros.');
  publicKeyNoticeStr = ('NOTE: Looking up transactions using a public key will ' +
    'currently only return transactions with at least one ' +
    'confirmation (i.e. transactions that have already been mined into a block).');
  publicKeyNotice = '';

  blockRes: any;
  txnRes: any;
  hasParam = false;

  hasInitialized = false;
  txnsLoading =  false;

  // Pagination variables
  PAGE_SIZE = 10;
  CURRENT_PAGE = 1;
  PAGES: {[k: number]: any} = {};
  LastTransactionIDBase58Check = '';
  LastPublicKeyTransactionIndex = -1;

  ngOnInit(): void {
    // Debounce because angular fires twice when loading with a param
    this.route.queryParams.pipe(debounceTime(200)).subscribe((params: Params) => {
      this.hasInitialized = true;
      this.refreshParams(params);
    });
  }

  refreshParams(params: any): void {
    this.publicKeyNotice = '';

    if (params['query-node'] != null) {
      this.queryNode = params['query-node'];
    }

    if (this.queryNode === '') {
      this.queryNode = 'https://api.bitclout.com';
    }

    if (params.mempool) {
      this.explorerQuery = 'mempool';
    } else if (params['block-hash'] != null) {
      this.explorerQuery = params['block-hash'];
    } else if (params['block-height'] != null) {
      this.explorerQuery = params['block-height'];
    } else if (params['transaction-id'] != null) {
      this.explorerQuery = params['transaction-id'];
    } else if (params['public-key'] != null) {
      this.explorerQuery = params['public-key'];
      this.publicKeyNotice = this.publicKeyNoticeStr;
    } else {
      this.explorerQuery = 'tip';
    }

    console.log(this.queryNode);
    console.log(this.explorerQuery);
    this.submitQuery();
  }

  searchEnterPressed(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    this.relocateForQuery();
  }

  copy(val: string): void {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = val;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
  }

  relocateForQuery(): void {
    if (this.explorerQuery == null || this.explorerQuery === '') {
      alert(this.errorStr);
      return;
    }

    // Reset the pagination
    this.CURRENT_PAGE = 1;
    this.PAGES = {};
    this.LastPublicKeyTransactionIndex = -1;
    this.LastTransactionIDBase58Check = '';

    if (this.explorerQuery.startsWith('BC') || this.explorerQuery.startsWith('tBC')) {
      this.router.navigate(['/'], { queryParams: { 'query-node': this.queryNode, 'public-key': this.explorerQuery }});
    } else if (this.explorerQuery === 'mempool') {
      this.router.navigate(['/'], { queryParams: { 'query-node': this.queryNode, mempool: true }});
    } else if (this.explorerQuery.startsWith('3Ju') || this.explorerQuery.startsWith('CbU')) {
      this.router.navigate(['/'], { queryParams: { 'query-node': this.queryNode, 'transaction-id': this.explorerQuery }});
    } else if (this.explorerQuery.length === 64) {
      this.router.navigate(['/'], { queryParams: { 'query-node': this.queryNode, 'block-hash': this.explorerQuery }});
    } else if (parseInt(this.explorerQuery, 10) != null && !isNaN(parseInt(this.explorerQuery, 10))) {
      this.router.navigate(['/'], { queryParams: { 'query-node': this.queryNode, 'block-height': this.explorerQuery}});
    } else {
      alert(this.errorStr);
    }
  }

  responseHandler(context: AppComponent, res: any): void {
    if (res?.Header) {
      this.blockRes = res;
      this.blockRes.Header.DateTime = new Date(this.blockRes.Header.TstampSecs * 1000);
    }

    if (res.Transactions) {
      // Clear unnecessary fields
      for (const vv of res.Transactions) {
        if (vv && vv.TransactionMetadata && vv.TransactionMetadata.BasicTransferTxindexMetadata &&
          vv.TransactionMetadata.BasicTransferTxindexMetadata.UtxoOpsDump) {
          vv.TransactionMetadata.BasicTransferTxindexMetadata.UtxoOpsDump = 'redacted';
        }
      }

      res.Transactions.reverse();
      this.txnRes = {
        Transactions: res.Transactions,
        LastTransactionIDBase58Check: res.LastTransactionIDBase58Check,
        LastPublicKeyTransactionIndex: res.LastPublicKeyTransactionIndex,
      };
      this.LastTransactionIDBase58Check = res.LastTransactionIDBase58Check;
      this.LastPublicKeyTransactionIndex = res.LastPublicKeyTransactionIndex;
      this.PAGES[this.CURRENT_PAGE] = this.txnRes;
    }

    this.ref.detectChanges();
    this.txnsLoading = false;
  }

  errorHandler(context: AppComponent, err: any): void {
    let errorMessage;

    if (err.error != null && err.error.Error != null) {
      // Is it obvious yet that I'm not a frontend gal?
      // TODO: Error handling between BE and FE needs a major redesign.
      errorMessage = err.error.Error;
    } else if (err.status != null && err.status !== 200) {
      errorMessage = 'Error connecting to query node: ' + this.queryNode;
    } else {
      errorMessage = 'Unknown error occurred: ' + JSON.stringify(err);
    }

    alert(errorMessage);
    this.txnsLoading = false;
  }

  submitQuery(): void {
    if (this.explorerQuery == null || this.explorerQuery === '') {
      alert(this.errorStr);
      return;
    }

    // If we're calling submitQuery, set hasParam so the tip node information stops showing.
    this.hasParam = true;
    this.blockRes = null;
    this.txnRes = null;
    this.txnsLoading = true;

    if (this.explorerQuery === 'tip') {
      this.httpClient.get<any>(
        `${this.queryNode}/api/v1`
      ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));
    } else if (this.explorerQuery.startsWith('BC') || this.explorerQuery.startsWith('tBC')) {
      // If the string starts with "BC" we treat it as a public key query.
      this.httpClient.post<any>(
        `${this.queryNode}/api/v1/transaction-info`, {
          PublicKeyBase58Check: this.explorerQuery,
          LastTransactionIDBase58Check: this.LastTransactionIDBase58Check,
          LastPublicKeyTransactionIndex: this.LastPublicKeyTransactionIndex,
          Limit: this.PAGE_SIZE,
        }).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (this.explorerQuery === 'mempool') {
      this.httpClient.post<any>(
      `${this.queryNode}/api/v1/transaction-info`, {
          IsMempool: true,
          LastTransactionIDBase58Check: this.LastTransactionIDBase58Check,
          Limit: this.PAGE_SIZE,
      }).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (this.explorerQuery.startsWith('3Ju') || this.explorerQuery.startsWith('CbU')) {
      // If the string starts with 3Ju we treat it as a transaction ID.
      this.httpClient.post<any>(
      `${this.queryNode}/api/v1/transaction-info`, {
        TransactionIDBase58Check: this.explorerQuery,
      }).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (this.explorerQuery.length === 64) {
      // If it's 64 characters long, we know we're dealing with a block hash.
      this.httpClient.post<any>(
        `${this.queryNode}/api/v1/block`, {
        HashHex: this.explorerQuery,
        FullBlock: true,
      }).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (parseInt(this.explorerQuery, 10) != null && !isNaN(parseInt(this.explorerQuery, 10))) {
      // As a last attempt, if the query can be parsed as a block height, then do that.
      this.httpClient.post<any>(
      `${this.queryNode}/api/v1/block`, {
        Height: parseInt(this.explorerQuery, 10),
        FullBlock: true,
      }).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else {
      this.txnsLoading = false;
      alert(this.errorStr);
    }
  }

  showNextPageBtn(): boolean {
    return this.txnRes && this.txnRes.Transactions && this.txnRes.Transactions.length === this.PAGE_SIZE;
  }

  nextPage(): void {
    this.getPage(this.CURRENT_PAGE + 1);
  }

  prevPage(): void {
    if (this.CURRENT_PAGE === 1) {
      alert('Invalid page');
      return;
    }
    this.getPage(this.CURRENT_PAGE - 1);
  }

  getPage(page: number): void {
    this.CURRENT_PAGE = page;
    if (this.CURRENT_PAGE in this.PAGES) {
      this.txnRes = this.PAGES[this.CURRENT_PAGE];
      this.LastTransactionIDBase58Check = this.txnRes.LastTransactionIDBase58Check;
      this.LastPublicKeyTransactionIndex = this.txnRes.LastPublicKeyTransactionIndex;
    } else {
      this.submitQuery();
    }
  }
}
