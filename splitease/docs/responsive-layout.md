# Responsive layout checks

The prototype adapts at phone (up to 640px), tablet (641-1024px), laptop, and large-screen widths.

- Buttons, navigation, icon controls, selectors and disclosure controls have touch areas at least 44px high/wide in tested states. Primary actions are 46-54px tall.
- Phone navigation uses its own row. Forms stack, share actions wrap, long participant names wrap, and repayment tables become labelled cards below 480px.
- Tablet forms retain two columns where space allows. Payment options and amount summaries use larger columns.
- Laptop content has a readable maximum width and consistent spacing. The checkout bar aligns with the content.
- Fields use 16px input text. Dialogs fit the viewport, scroll internally, and have 44px close controls. Page padding and scroll margins account for the sticky header and fixed bottom checkout bar.
- Hover, pressed, selected, focus-visible and disabled styles are provided. Reduced-motion preferences disable transitions.

Browser checks cover 320x740, 390x844, 768x1024, 1024x768, 1366x768 and 1920x1080. Each size exercises setup, participants, share links, invitation QR, summary/add-person/account dialogs, instalments, scanner and activity. Tests assert no page-level horizontal overflow and minimum interactive target sizes. Screenshots are generated under ignored test-results/responsive.

These checks use desktop Edge with resized viewports. Physical iOS/Android device behaviour and on-screen keyboard handling still need device testing.
