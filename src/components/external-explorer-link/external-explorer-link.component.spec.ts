import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExternalExplorerLinkComponent } from './external-explorer-link.component';

describe('ExternalExplorerLinkComponent', () => {
  let component: ExternalExplorerLinkComponent;
  let fixture: ComponentFixture<ExternalExplorerLinkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ExternalExplorerLinkComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ExternalExplorerLinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
