import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

@Directive({ selector: 'dialog[appSheet]' })
export class SheetDirective implements AfterViewInit, OnDestroy {
  private readonly dialog = inject<ElementRef<HTMLDialogElement>>(ElementRef).nativeElement;

  ngAfterViewInit(): void {
    this.dialog.showModal();
  }

  ngOnDestroy(): void {
    this.dialog.close();
  }
}
