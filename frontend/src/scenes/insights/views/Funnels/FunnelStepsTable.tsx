import { useActions, useValues } from 'kea'
import { funnelLogic } from 'scenes/funnels/funnelLogic'
import { insightLogic } from 'scenes/insights/insightLogic'
import { LemonTable, LemonTableColumn, LemonTableColumnGroup } from 'lib/lemon-ui/LemonTable'
import {
    FlattenedFunnelStepByBreakdown,
    FunnelStep,
    FunnelStepWithConversionMetrics,
    FunnelStepWithNestedBreakdown,
} from '~/types'
import { EntityFilterInfo } from 'lib/components/EntityFilterInfo'
import { getVisibilityKey } from 'scenes/funnels/funnelUtils'
import { getActionFilterFromFunnelStep, getSignificanceFromBreakdownStep } from './funnelStepTableUtils'
import { cohortsModel } from '~/models/cohortsModel'
import { LemonCheckbox } from 'lib/lemon-ui/LemonCheckbox'
import { Lettermark, LettermarkColor } from 'lib/lemon-ui/Lettermark'
import { LemonRow } from 'lib/lemon-ui/LemonRow'
import { humanFriendlyDuration, humanFriendlyNumber, percentage } from 'lib/utils'
import { ValueInspectorButton } from 'scenes/funnels/ValueInspectorButton'
import { getSeriesColor } from 'lib/colors'
import { IconFlag } from 'lib/lemon-ui/icons'
import { propertyDefinitionsModel } from '~/models/propertyDefinitionsModel'
import { formatBreakdownLabel } from 'scenes/insights/utils'
import { insightDataLogic } from 'scenes/insights/insightDataLogic'
import { funnelDataLogic } from 'scenes/funnels/funnelDataLogic'
import { BreakdownFilter } from '~/queries/schema'
import { cleanHiddenLegendSeries } from '~/queries/nodes/InsightQuery/utils/filtersToQueryNode'

export function FunnelStepsTableDataExploration(): JSX.Element | null {
    const { insightProps, insightLoading } = useValues(insightLogic)
    const { breakdown } = useValues(insightDataLogic(insightProps))
    const { steps, flattenedBreakdowns, funnelsFilter } = useValues(funnelDataLogic(insightProps))
    const { updateInsightFilter } = useActions(funnelDataLogic(insightProps))
    const { openPersonsModalForSeries } = useActions(funnelLogic(insightProps))

    return (
        <FunnelStepsTableComponent
            insightLoading={insightLoading}
            breakdownFilter={breakdown}
            steps={steps}
            flattenedBreakdowns={flattenedBreakdowns}
            isOnlySeries={flattenedBreakdowns.length <= 1}
            hiddenLegendBreakdowns={funnelsFilter?.hidden_legend_breakdowns}
            setHiddenLegendBreakdowns={(hidden_legend_breakdowns: string[]) => {
                updateInsightFilter({ hidden_legend_breakdowns })
            }}
            openPersonsModalForSeries={openPersonsModalForSeries}
        />
    )
}

export function FunnelStepsTable(): JSX.Element | null {
    const { insightProps, insightLoading } = useValues(insightLogic)
    const { filters, steps, flattenedBreakdowns, hiddenLegendKeys, isOnlySeries } = useValues(funnelLogic(insightProps))
    const { setFilters, openPersonsModalForSeries } = useActions(funnelLogic(insightProps))

    return (
        <FunnelStepsTableComponent
            insightLoading={insightLoading}
            breakdownFilter={filters}
            steps={steps}
            flattenedBreakdowns={flattenedBreakdowns}
            setHiddenLegendBreakdowns={(hidden_legend_breakdowns: string[]) => {
                const hidden_legend_keys = hidden_legend_breakdowns.reduce((k, b) => ({ ...k, [b]: true }), {})
                setFilters({ ...filters, hidden_legend_keys })
            }}
            hiddenLegendBreakdowns={cleanHiddenLegendSeries(hiddenLegendKeys)}
            isOnlySeries={isOnlySeries}
            openPersonsModalForSeries={openPersonsModalForSeries}
        />
    )
}

type FunnelStepsTableComponentProps = {
    insightLoading: boolean
    breakdownFilter?: BreakdownFilter
    steps: FunnelStepWithNestedBreakdown[]
    flattenedBreakdowns: FlattenedFunnelStepByBreakdown[]
    isOnlySeries: boolean
    hiddenLegendBreakdowns: string[] | undefined
    setHiddenLegendBreakdowns: (hidden_legend_breakdowns: string[]) => void
    openPersonsModalForSeries: ({
        step,
        series,
        converted,
    }: {
        step: FunnelStep
        series: Omit<FunnelStepWithConversionMetrics, 'nested_breakdown'>
        converted: boolean
    }) => void
}

export function FunnelStepsTableComponent({
    insightLoading,
    breakdownFilter,
    steps,
    flattenedBreakdowns,
    hiddenLegendBreakdowns,
    setHiddenLegendBreakdowns,
    isOnlySeries,
    openPersonsModalForSeries,
}: FunnelStepsTableComponentProps): JSX.Element | null {
    const { cohorts } = useValues(cohortsModel)
    const { formatPropertyValueForDisplay } = useValues(propertyDefinitionsModel)

    const allChecked = flattenedBreakdowns?.every(
        (b) => !hiddenLegendBreakdowns?.includes(getVisibilityKey(b.breakdown_value))
    )
    const someChecked = flattenedBreakdowns?.some(
        (b) => !hiddenLegendBreakdowns?.includes(getVisibilityKey(b.breakdown_value))
    )
    const toggleLegendBreakdownVisibility = (breakdown: string): void => {
        hiddenLegendBreakdowns?.includes(breakdown)
            ? setHiddenLegendBreakdowns(hiddenLegendBreakdowns.filter((b) => b !== breakdown))
            : setHiddenLegendBreakdowns([...(hiddenLegendBreakdowns || []), breakdown])
    }

    const columnsGrouped = [
        {
            children: [
                {
                    title: isOnlySeries ? (
                        'Breakdown'
                    ) : (
                        <LemonCheckbox
                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                            onChange={() => {
                                // Either toggle all breakdowns on or off
                                setHiddenLegendBreakdowns(
                                    allChecked
                                        ? flattenedBreakdowns.map((b) => getVisibilityKey(b.breakdown_value))
                                        : []
                                )
                            }}
                            label={<span className="font-bold">Breakdown</span>}
                            size="small"
                        />
                    ),
                    dataIndex: 'breakdown_value',
                    render: function RenderBreakdownValue(
                        _: void,
                        breakdown: FlattenedFunnelStepByBreakdown
                    ): JSX.Element {
                        // :KLUDGE: `BreakdownStepValues` is always wrapped into an array, which doesn't work for the
                        // formatBreakdownLabel logic. Instead, we unwrap speculatively
                        const value =
                            breakdown.breakdown_value?.length == 1
                                ? breakdown.breakdown_value[0]
                                : breakdown.breakdown_value
                        const label = formatBreakdownLabel(
                            cohorts,
                            formatPropertyValueForDisplay,
                            value,
                            breakdown.breakdown,
                            breakdownFilter?.breakdown_type
                        )
                        return isOnlySeries ? (
                            <span className="font-medium">{label}</span>
                        ) : (
                            <LemonCheckbox
                                checked={!hiddenLegendBreakdowns?.includes(getVisibilityKey(breakdown.breakdown_value))}
                                onChange={() =>
                                    toggleLegendBreakdownVisibility(getVisibilityKey(breakdown.breakdown_value))
                                }
                                label={label}
                            />
                        )
                    },
                },
                {
                    title: (
                        <>
                            Total
                            <br />
                            conversion
                        </>
                    ),
                    render: (_: void, breakdown: FlattenedFunnelStepByBreakdown) =>
                        percentage(breakdown?.conversionRates?.total ?? 0, 2, true),
                    align: 'right',
                },
            ],
        },
        ...steps.map((step, stepIndex) => ({
            title: (
                <LemonRow
                    icon={<Lettermark name={stepIndex + 1} color={LettermarkColor.Gray} />}
                    style={{ font: 'inherit', padding: 0 }}
                    size="small"
                >
                    <EntityFilterInfo filter={getActionFilterFromFunnelStep(step)} />
                </LemonRow>
            ),
            children: [
                {
                    title: stepIndex === 0 ? 'Entered' : 'Converted',
                    render: function RenderCompleted(
                        _: void,
                        breakdown: FlattenedFunnelStepByBreakdown
                    ): JSX.Element | undefined {
                        const stepSeries = breakdown.steps?.[stepIndex]
                        return (
                            stepSeries && (
                                <ValueInspectorButton
                                    onClick={() =>
                                        openPersonsModalForSeries({ step, series: stepSeries, converted: true })
                                    }
                                    style={{ padding: 0 }}
                                >
                                    {humanFriendlyNumber(stepSeries.count ?? 0)}
                                </ValueInspectorButton>
                            )
                        )
                    },

                    align: 'right',
                },
                ...(stepIndex === 0
                    ? []
                    : [
                          {
                              title: 'Dropped off',
                              render: function RenderDropped(
                                  _: void,
                                  breakdown: FlattenedFunnelStepByBreakdown
                              ): JSX.Element | undefined {
                                  const stepSeries = breakdown.steps?.[stepIndex]
                                  return (
                                      stepSeries && (
                                          <ValueInspectorButton
                                              onClick={() =>
                                                  openPersonsModalForSeries({
                                                      step,
                                                      series: stepSeries,
                                                      converted: false,
                                                  })
                                              }
                                              style={{ padding: 0 }}
                                          >
                                              {humanFriendlyNumber(stepSeries.droppedOffFromPrevious ?? 0)}
                                          </ValueInspectorButton>
                                      )
                                  )
                              },
                              align: 'right',
                          },
                      ]),
                {
                    title: (
                        <>
                            Conversion
                            <br />
                            so&nbsp;far
                        </>
                    ),
                    render: function RenderConversionSoFar(
                        _: void,
                        breakdown: FlattenedFunnelStepByBreakdown
                    ): JSX.Element | string {
                        const significance = getSignificanceFromBreakdownStep(breakdown, step.order)
                        return significance?.total ? (
                            <LemonRow
                                className="significance-highlight"
                                tooltip="Significantly different from other breakdown values"
                                icon={<IconFlag />}
                                size="small"
                            >
                                {percentage(breakdown.steps?.[step.order]?.conversionRates.total ?? 0, 2, true)}
                            </LemonRow>
                        ) : (
                            percentage(breakdown.steps?.[step.order]?.conversionRates.total ?? 0, 2, true)
                        )
                    },
                    align: 'right',
                },
                ...(stepIndex === 0
                    ? []
                    : [
                          {
                              title: (
                                  <>
                                      Conversion
                                      <br />
                                      from&nbsp;previous
                                  </>
                              ),
                              render: function RenderConversionFromPrevious(
                                  _: void,
                                  breakdown: FlattenedFunnelStepByBreakdown
                              ): JSX.Element | string {
                                  const significance = getSignificanceFromBreakdownStep(breakdown, step.order)
                                  // Only flag as significant here if not flagged already in "Conversion so far"
                                  return !significance?.total && significance?.fromPrevious ? (
                                      <LemonRow
                                          className="significance-highlight"
                                          tooltip="Significantly different from other breakdown values"
                                          icon={<IconFlag />}
                                          size="small"
                                      >
                                          {percentage(
                                              breakdown.steps?.[step.order]?.conversionRates.fromPrevious ?? 0,
                                              2,
                                              true
                                          )}
                                      </LemonRow>
                                  ) : (
                                      percentage(
                                          breakdown.steps?.[step.order]?.conversionRates.fromPrevious ?? 0,
                                          2,
                                          true
                                      )
                                  )
                              },
                              align: 'right',
                          },
                          {
                              title: (
                                  <>
                                      Median
                                      <br />
                                      time
                                  </>
                              ),
                              render: (_: void, breakdown: FlattenedFunnelStepByBreakdown) =>
                                  breakdown.steps?.[step.order]?.median_conversion_time != undefined
                                      ? humanFriendlyDuration(breakdown.steps[step.order].median_conversion_time, 3)
                                      : '–',
                              align: 'right',
                              width: 0,
                              className: 'whitespace-nowrap',
                          },
                          {
                              title: (
                                  <>
                                      Average
                                      <br />
                                      time
                                  </>
                              ),
                              render: (_: void, breakdown: FlattenedFunnelStepByBreakdown) =>
                                  breakdown.steps?.[step.order]?.average_conversion_time != undefined
                                      ? humanFriendlyDuration(breakdown.steps[step.order].average_conversion_time, 3)
                                      : '–',
                              align: 'right',
                              width: 0,
                              className: 'whitespace-nowrap',
                          },
                      ]),
            ] as LemonTableColumn<FlattenedFunnelStepByBreakdown, keyof FlattenedFunnelStepByBreakdown>[],
        })),
    ] as LemonTableColumnGroup<FlattenedFunnelStepByBreakdown>[]

    return (
        <LemonTable
            dataSource={flattenedBreakdowns}
            columns={columnsGrouped}
            loading={insightLoading}
            rowKey="breakdownIndex"
            rowStatus={(record) => (record.significant ? 'highlighted' : null)}
            rowRibbonColor={(series) => getSeriesColor(series?.breakdownIndex ?? 0)}
        />
    )
}
