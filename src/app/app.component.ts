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

  blockRes: any;
  txnRes: any;
  hasParam = false;

  hasInitialized = false;
  txnsLoading =  false;

  // Pagination variables
  PAGE_SIZE = 200;
  CURRENT_PAGE = 1;
  PAGES: {[k: number]: any} = {};
  LastTransactionIDBase58Check = '';
  LastPublicKeyTransactionIndex = -1;

  ngOnInit(): void {
    // Debounce because angular fires twice when loading with a param
    this.route.queryParams.pipe(debounceTime(10)).subscribe((params: Params) => {
      this.hasInitialized = true;
      this.refreshParams(params);
    });
  }

  refreshParams(params: any): void {
    if (params['query-node'] != null) {
      this.queryNode = params['query-node'];
    }

    if (this.queryNode === '') {
      this.queryNode = 'https://api.bitclout.com';
    }

    let newQuery = ''
    if (params.mempool) {
      newQuery = 'mempool';
    } else if (params['block-hash'] != null) {
      newQuery = params['block-hash'];
    } else if (params['block-height'] != null) {
      newQuery = params['block-height'];
    } else if (params['transaction-id'] != null) {
      newQuery = params['transaction-id'];
    } else if (params['public-key'] != null) {
      newQuery = params['public-key'];
    } else {
      newQuery = 'tip';
    }

    if (params['last-txn-idx'] != null) {
      this.LastPublicKeyTransactionIndex = Number(params['last-txn-idx']);
    }

    if (params['last-txn-hash'] != null) {
      this.LastTransactionIDBase58Check = params['last-txn-hash'];
    }

    if (params['page'] != null) {
      this.CURRENT_PAGE = Number(params['page']);
    }

    console.log(this.queryNode);
    console.log(this.explorerQuery);

    this.explorerQuery = newQuery;

    this.submitQuery(newQuery);
  }

  searchButtonPressed(): void {
    this.resetPagination();
    this.relocateForQuery();
  }

  searchEnterPressed(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    this.resetPagination();
    this.relocateForQuery();
  }

  linkClicked(event: MouseEvent, query: string) {
    event.preventDefault();

    this.explorerQuery = query;
    this.resetPagination();
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

  resetPagination(): void {
    // Reset the pagination
    this.CURRENT_PAGE = 1;
    this.PAGES = {};
    this.LastPublicKeyTransactionIndex = -1;
    this.LastTransactionIDBase58Check = '';
  }

  relocateForQuery(): void {
    if (this.explorerQuery == null || this.explorerQuery === '') {
      alert(this.errorStr);
      return;
    }

    if (this.explorerQuery.startsWith('BC') || this.explorerQuery.startsWith('tBC')) {
      this.router.navigate(['/'], { queryParams: {
        'query-node': this.queryNode,
        'public-key': this.explorerQuery,
        'last-txn-idx': this.LastPublicKeyTransactionIndex,
        'page': this.CURRENT_PAGE,
      }});

    } else if (this.explorerQuery === 'mempool') {
      this.router.navigate(['/'], { queryParams: {
        'query-node': this.queryNode,
        'last-txn-hash': this.LastTransactionIDBase58Check,
        'page': this.CURRENT_PAGE,
        mempool: true
      }});

    } else if (this.explorerQuery.startsWith('0')) {
      this.router.navigate(['/'], { queryParams: {
        'query-node': this.queryNode,
        'block-hash': this.explorerQuery
       }});

    } else if (this.explorerQuery.startsWith('3Ju') || this.explorerQuery.startsWith('CbU') || this.explorerQuery.length === 64) {
      this.router.navigate(['/'], { queryParams: {
        'query-node': this.queryNode,
        'transaction-id': this.explorerQuery
      }});

    } else if (parseInt(this.explorerQuery, 10) != null && !isNaN(parseInt(this.explorerQuery, 10))) {
      this.router.navigate(['/'], { queryParams: {
        'query-node': this.queryNode,
        'block-height': this.explorerQuery
      }});

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

      // Reverse the list so newest transactions are at the top of the page
      res.Transactions.reverse();

      this.txnRes = {
        Transactions: res.Transactions,
        LastTransactionIDBase58Check: res.LastTransactionIDBase58Check,
        LastPublicKeyTransactionIndex: res.LastPublicKeyTransactionIndex,
        BalanceNanos: res.BalanceNanos,
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

  submitQuery(query: string): void {
    console.log('Submitting query');

    if (query == null || query === '') {
      console.error(this.errorStr)
      alert(this.errorStr);
      return;
    }

    // Cache paginated results
    if (this.CURRENT_PAGE in this.PAGES) {
      console.log('Using cached paginated results for page ' + this.CURRENT_PAGE);
      this.txnRes = this.PAGES[this.CURRENT_PAGE];
      this.LastTransactionIDBase58Check = this.txnRes.LastTransactionIDBase58Check;
      this.LastPublicKeyTransactionIndex = this.txnRes.LastPublicKeyTransactionIndex;
      return
    }

    // If we're calling submitQuery, set hasParam so the tip node information stops showing.
    this.hasParam = true;
    this.blockRes = null;
    this.txnRes = null;
    this.txnsLoading = true;

    if (query === 'tip') {
      this.httpClient.get<any>(
        `${this.queryNode}/api/v1`, { withCredentials: true }
      ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));
    } else if (query.startsWith('BC') || query.startsWith('tBC')) {
      // If the string starts with "BC" we treat it as a public key query.
      this.httpClient.post<any>(
        `${this.queryNode}/api/v1/transaction-info`, {
          PublicKeyBase58Check: query,
          LastTransactionIDBase58Check: this.LastTransactionIDBase58Check,
          LastPublicKeyTransactionIndex: this.LastPublicKeyTransactionIndex,
          Limit: this.PAGE_SIZE,
        }, { withCredentials: true }
        ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (query === 'mempool') {
      this.httpClient.post<any>(
      `${this.queryNode}/api/v1/transaction-info`, {
          IsMempool: true,
          LastTransactionIDBase58Check: this.LastTransactionIDBase58Check,
          Limit: this.PAGE_SIZE,
      }, { withCredentials: true }
      ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));
    } else if (query.startsWith('0')) {
      // If it starts with a 0, we know we're dealing with a block hash.
      this.httpClient.post<any>(
        `${this.queryNode}/api/v1/block`, {
        HashHex: query,
        FullBlock: true,
      }, { withCredentials: true }
      ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (query.startsWith('3Ju') || query.startsWith('CbU') || query.length === 64) {
      // If the string starts with 3Ju/CbU/or 64 chars (hex rosetta version) we treat it as a transaction ID.
      this.httpClient.post<any>(
      `${this.queryNode}/api/v1/transaction-info`, {
        TransactionIDBase58Check: query,
      }, { withCredentials: true }
      ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else if (parseInt(query, 10) != null && !isNaN(parseInt(query, 10))) {
      // As a last attempt, if the query can be parsed as a block height, then do that.
      this.httpClient.post<any>(
      `${this.queryNode}/api/v1/block`, {
        Height: parseInt(query, 10),
        FullBlock: true,
      }, { withCredentials: true }
      ).subscribe((res) => this.responseHandler(this, res), (err) => this.errorHandler(this, err));

    } else {
      this.txnsLoading = false;
      alert(this.errorStr);
    }
  }

  showNextPageBtn(): boolean {
    return (
      // We have a response with transactions
      this.txnRes &&
      this.txnRes.Transactions &&
      // That is at least PAGE_SIZE
      this.txnRes.Transactions.length >= this.PAGE_SIZE &&
      // That is not a block
      !this.txnRes.Header
    ) || (
      // OR we are loading transactions and on 2+ page
      this.txnsLoading && this.CURRENT_PAGE >= 2
    );
  }

  nextPage(): void {
    if (this.txnsLoading) {
      return;
    }

    this.CURRENT_PAGE += 1;
    this.relocateForQuery();
  }

  prevPage(): void {
    if (this.txnsLoading) {
      return;
    }

    this.CURRENT_PAGE -= 1;
    this.relocateForQuery();
  }
}
