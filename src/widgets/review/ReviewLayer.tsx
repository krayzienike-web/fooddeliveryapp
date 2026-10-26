import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '@/app/navigation/ref';
import { anchorLabel, anchorName, parseAnchor, ROUTE_TITLE, routeFor } from '@/features/feedback/model/anchors';
import { batchParts, KIND_TITLE, MAX_NOTE, type ReviewKind } from '@/features/review/model/batch';
import { useReview, type ReviewTarget } from '@/features/review/model/store';
import { deliveryChannel, sendBatch, type Channel } from '@/services/review/commentsClient';
import { E2E, IS_E2E } from '@/shared/config/env';
import { haptic } from '@/shared/lib/haptics';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, Chip, Icon, IconButton, PressableScale, Sheet, Txt, toast } from '@/shared/ui';
import { currentScreen } from '@/widgets/feedback/screen';
import { startTapPicker } from '@/widgets/feedback/tapPicker';

/** Marks our own controls so the tap picker lets them work while picking. */
const OWN_UI = { dataSet: { reviewUi: '1' } } as object;

const KINDS: ReviewKind[] = ['change', 'bug', 'idea'];

const CHANNEL_CTA: Record<Channel, string> = {
  claude: 'Отправить в работу',
  comment: 'Сохранить пачкой в комментарии',
  clipboard: 'Скопировать пачку',
  none: 'Отправка недоступна',
};
const CHANNEL_HINT: Record<Channel, string> = {
  claude: 'Уйдёт одной веткой комментариев с «Send to Claude» — Claude возьмёт всё как одну задачу и ответит в ветке.',
  comment: 'Claude сейчас не на связи: пачка сохранится комментарием, его заберут, когда попросите «забери правки».',
  clipboard: 'Вне claude.ai: текст пачки скопируется — вставьте его в чат с Claude.',
  none: 'Откройте демо в claude.ai, чтобы отправлять правки.',
};
const ERROR_TEXT: Record<string, string> = {
  consent_required: 'Разрешите странице писать комментарии от вашего имени и нажмите ещё раз',
  forbidden: 'Комментарии со страницы выключены для вас — черновики остались',
  rate_limited: 'Слишком часто — подождите минуту, черновики остались',
  claude_unavailable: 'Claude сейчас не на связи — можно сохранить пачку комментарием',
  clipboard: 'Браузер не дал скопировать текст',
};

function screenTarget(text: string | null, testId: string | null): ReviewTarget | null {
  const here = currentScreen();
  if (!here) return null;
  return { anchor: anchorName({ ...here, target: testId ?? 'screen' }), route: here.route, label: anchorLabel(here.route, testId ? text : null) };
}

function goTo(anchor: string) {
  const a = parseAnchor(anchor);
  if (!a || !navigationRef.isReady()) return;
  const here = currentScreen();
  if (here && here.route === a.route && (here.key ?? '') === (a.key ?? '')) return;
  const to = routeFor(a);
  (navigationRef.navigate as (name: string, params?: object) => void)(to.name, to.params);
}

function Composer() {
  const { c } = useTheme();
  const composing = useReview((s) => s.composing);
  const drafts = useReview((s) => s.drafts);
  const { save, remove, closeComposer } = useReview.getState();
  const draft = composing?.draftId ? drafts.find((d) => d.id === composing.draftId) : undefined;
  const [kind, setKind] = useState<ReviewKind>('change');
  const [text, setText] = useState('');

  useEffect(() => {
    setKind(draft?.kind ?? 'change');
    setText(draft?.text ?? '');
  }, [composing]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = composing?.target;
  const ok = text.trim().length > 0;
  return (
    <Sheet open={!!composing} onClose={closeComposer} title={draft ? 'Правка' : 'Новая правка'} testID="review-composer">
      <View style={{ paddingHorizontal: space.xl, paddingBottom: space.l, gap: space.m }}>
        {target ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
            <Icon name="target" size={16} color="textTertiary" />
            <Txt v="bodyM" color="textSecondary" numberOfLines={2} style={{ flex: 1 }} testID="review-composer-target">
              {target.label}
            </Txt>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.s }}>
          {KINDS.map((k) => (
            <Chip key={k} small testID={`review-kind-${k}`} label={KIND_TITLE[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        <TextInput
          testID="review-text"
          value={text}
          onChangeText={setText}
          placeholder="Что не так и как должно быть"
          placeholderTextColor={c.textTertiary}
          multiline
          autoFocus
          maxLength={MAX_NOTE}
          style={[typeScale.bodyL, { minHeight: 110, maxHeight: 220, minWidth: 0, color: c.textPrimary, backgroundColor: c.surfaceRaised, borderRadius: radius.m, borderWidth: 1, borderColor: c.outline, padding: space.m, textAlignVertical: 'top', outlineStyle: 'none' } as object]}
        />
        <Button
          testID="review-save"
          title={draft ? 'Сохранить' : 'Добавить в пачку'}
          disabled={!ok || !target}
          onPress={() => {
            if (!target) return;
            haptic.tick();
            save({ target, kind, text: text.trim(), draftId: draft?.id });
            toast(draft ? 'Правка обновлена' : 'Добавлено в пачку', { icon: 'playlist-plus' });
          }}
        />
        {draft ? <Button testID="review-delete" kind="ghost" size="m" icon="delete-outline" title="Удалить правку" onPress={() => remove(draft.id)} /> : null}
      </View>
    </Sheet>
  );
}

function Panel() {
  const { c } = useTheme();
  const open = useReview((s) => s.panel);
  const drafts = useReview((s) => s.drafts);
  const sent = useReview((s) => s.sent);
  const { setPanel, setPicking, compose, markSent } = useReview.getState();
  const [channel, setChannel] = useState<Channel>('none');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) deliveryChannel().then(setChannel, () => setChannel('none'));
  }, [open]);

  // Group by screen, in order of first note.
  const groups = useMemo(() => {
    const m = new Map<string, typeof drafts>();
    for (const d of drafts) {
      const k = d.anchor.split(' › ')[0];
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return [...m.entries()];
  }, [drafts]);

  const send = async () => {
    const root = document.getElementById('root') ?? document.body;
    setSending(true);
    const out = await sendBatch(batchParts(drafts), root, channel);
    setSending(false);
    if (out.via && out.sentIds.length) {
      markSent(out.sentIds, out.via);
      haptic.confirm();
      toast(out.via === 'claude' ? `Отправлено в работу: ${out.sentIds.length}` : out.via === 'comment' ? 'Пачка сохранена в комментариях' : 'Пачка скопирована', { icon: 'send-check-outline' });
    }
    if (out.error) {
      toast(ERROR_TEXT[out.error] ?? 'Не отправилось — черновики остались, попробуйте ещё раз', { icon: 'alert-circle-outline' });
      if (out.error === 'claude_unavailable') setChannel('comment');
    } else if (out.via) setPanel(false);
  };

  const last = sent[0];
  return (
    <Sheet
      open={open}
      onClose={() => setPanel(false)}
      title={drafts.length ? `Пачка правок · ${drafts.length}` : 'Правки'}
      testID="review-panel"
      footer={
        drafts.length ? (
          <View style={{ gap: space.s }}>
            <Button testID="review-send" icon={channel === 'claude' ? 'send' : channel === 'clipboard' ? 'content-copy' : 'comment-text-outline'} title={`${CHANNEL_CTA[channel]} · ${drafts.length}`} loading={sending} disabled={channel === 'none' || sending} onPress={send} />
            <Txt v="caption" color="textTertiary" testID="review-channel">
              {CHANNEL_HINT[channel]}
            </Txt>
          </View>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.l, gap: space.l }}>
        <View style={{ flexDirection: 'row', gap: space.s }}>
          <Button testID="review-pick" kind="tonal" size="m" icon="cursor-default-click-outline" title="Элемент" style={{ flex: 1 }} onPress={() => setPicking(true)} />
          <Button
            testID="review-screen-note"
            kind="outline"
            size="m"
            icon="cellphone-text"
            title="Весь экран"
            style={{ flex: 1 }}
            onPress={() => {
              const t = screenTarget(null, null);
              if (t) compose(t);
            }}
          />
        </View>

        {drafts.length === 0 ? (
          <View style={{ gap: space.s, paddingVertical: space.m }} testID="review-empty">
            <Txt v="bodyL">Пачка пуста</Txt>
            <Txt v="bodyM" color="textSecondary">
              Нажмите «Элемент» и тапните по кнопке, карточке или тексту на любом экране — правка привяжется к нему. Копите сколько нужно, потом отправьте всё разом.
            </Txt>
          </View>
        ) : (
          groups.map(([screen, items]) => (
            <View key={screen} style={{ gap: space.s }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Txt v="label" color="textTertiary" upper style={{ flex: 1 }}>
                  {ROUTE_TITLE[items[0].route] ?? items[0].route}
                </Txt>
                <IconButton testID={`review-go-${items[0].id}`} icon="arrow-right" label="Открыть экран" tone="none" size={36} onPress={() => (setPanel(false), goTo(items[0].anchor))} />
              </View>
              {items.map((d) => (
                <PressableScale
                  key={d.id}
                  testID={`review-draft-${drafts.indexOf(d)}`}
                  onPress={() => compose({ anchor: d.anchor, route: d.route, label: d.label }, d.id)}
                  style={{ padding: space.m, borderRadius: radius.m, backgroundColor: c.surfaceRaised, gap: space.xs }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s }}>
                    <Txt v="label" color={d.kind === 'bug' ? 'accent' : d.kind === 'idea' ? 'gold' : 'textSecondary'}>
                      {KIND_TITLE[d.kind]}
                    </Txt>
                    <Txt v="caption" color="textTertiary" numberOfLines={1} style={{ flex: 1 }}>
                      {d.label}
                    </Txt>
                  </View>
                  <Txt v="bodyM" numberOfLines={3}>
                    {d.text}
                  </Txt>
                </PressableScale>
              ))}
            </View>
          ))
        )}

        {last ? (
          <Txt v="caption" color="textTertiary" testID="review-last-sent">
            Последняя пачка: {last.count} шт., {new Date(last.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} —{' '}
            {last.via === 'claude' ? 'в работе у Claude' : last.via === 'comment' ? 'в комментариях' : 'скопирована'}
          </Txt>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

/** While picking: taps tag elements; a banner offers «весь экран» and cancel. */
function PickBanner() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const picking = useReview((s) => s.picking);
  const { setPicking, compose } = useReview.getState();

  useEffect(() => {
    if (!picking) return;
    return startTapPicker((t) => {
      const target = screenTarget(t.text, t.testId);
      if (target) compose(target);
    }, c.accent);
  }, [picking, c.accent, compose]);

  if (!picking) return null;
  return (
    <View
      {...OWN_UI}
      testID="review-picking"
      style={{ position: 'absolute', top: insets.top + space.s, left: space.l, right: space.l, flexDirection: 'row', alignItems: 'center', gap: space.s, paddingLeft: space.l, paddingRight: space.xs, paddingVertical: space.xs, borderRadius: radius.l, backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.accent }}
    >
      <Icon name="cursor-default-click-outline" size={18} color="accent" />
      <Txt v="bodyM" style={{ flex: 1 }}>
        Тапните по элементу
      </Txt>
      <Chip
        small
        testID="review-pick-screen"
        label="Весь экран"
        onPress={() => {
          const t = screenTarget(null, null);
          if (t) compose(t);
        }}
      />
      <IconButton testID="review-pick-cancel" icon="close" label="Отменить выбор" tone="none" size={40} onPress={() => useReview.setState({ picking: false, panel: true })} />
    </View>
  );
}

function Fab() {
  const { c } = useTheme();
  const count = useReview((s) => s.drafts.length);
  const busy = useReview((s) => s.picking || !!s.composing || s.panel);
  if (busy) return null;
  return (
    <View {...OWN_UI} style={{ position: 'absolute', right: 0, top: '38%' }}>
      <PressableScale
        testID="review-fab"
        accessibilityLabel={count ? `Правки: ${count}` : 'Правки'}
        onPress={() => useReview.getState().setPanel(true)}
        style={{ width: 40, paddingVertical: space.m, alignItems: 'center', gap: space.xs, borderTopLeftRadius: radius.m, borderBottomLeftRadius: radius.m, backgroundColor: count ? c.accent : c.scrim }}
      >
        <Icon name="message-draw" size={20} raw={count ? c.onAccent : c.onPhoto} />
        {count ? (
          <Txt v="label" color="onAccent">
            {count}
          </Txt>
        ) : null}
      </PressableScale>
    </View>
  );
}

/**
 * Review mode for the published web demo (D0): a reviewer marks elements on any screen, collects notes into
 * a batch and sends the batch to work in one go. Web only; hidden in e2e unless the `review` flag is set.
 */
export function ReviewLayer() {
  if (Platform.OS !== 'web' || (IS_E2E && !E2E.review)) return null;
  return (
    <>
      <Fab />
      <PickBanner />
      <Composer />
      <Panel />
    </>
  );
}
