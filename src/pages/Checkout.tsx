import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  PAYMENT_CHANNELS,
  paymentSchema,
  type PaymentInput,
} from "../schemas/course.schema";
import { CourseService } from "../services/courses.service";
import { PurchaseService } from "../services/purchases.service";
import { PaymentService } from "../services/payment.service";
import { formatPrice } from "../components/CourseCard";
import Spinner from "../components/Spinner";
import ErrorMessage from "../components/ErrorMessage";

export default function Checkout() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const courseQuery = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => CourseService.getById(courseId!),
    enabled: Boolean(courseId),
  });

  const purchasedQuery = useQuery({
    queryKey: ["purchased-check", courseId],
    queryFn: () => PurchaseService.hasPurchased(courseId!),
    enabled: Boolean(courseId),
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_channel: "EVC", phone_number: "" },
  });

  // The phone placeholder follows the selected wallet (e.g. ZAAD → 634…).
  const selectedChannel = watch("payment_channel");
  const activeChannel =
    PAYMENT_CHANNELS.find((c) => c.value === selectedChannel) ?? PAYMENT_CHANNELS[0];

  if (courseQuery.isPending || purchasedQuery.isPending) {
    return <Spinner label="Sugaya…" />;
  }
  if (courseQuery.isError) {
    return <ErrorMessage error={courseQuery.error} onRetry={() => courseQuery.refetch()} />;
  }

  const course = courseQuery.data;

  if (purchasedQuery.data === true) {
    navigate(`/learn/${course.id}`, { replace: true });
    return null;
  }

  const isFree = Number(course.price) <= 0;

  async function onSubmit(values: PaymentInput) {
    setPayError(null);
    setPaying(true);
    try {
      await PaymentService.createPayment(
        course.id,
        values.payment_channel,
        values.phone_number
      );
      await queryClient.invalidateQueries({ queryKey: ["my-purchases"] });
      await queryClient.invalidateQueries({ queryKey: ["purchased", course.id] });
      await queryClient.invalidateQueries({ queryKey: ["purchased-check", course.id] });
      navigate(`/learn/${course.id}`, { replace: true });
    } catch (e) {
      setPayError(
        e instanceof Error ? e.message : "Lacag bixintu waa fashilantay. Fadlan mar kale isku day."
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="page page-narrow">
      <h1>Bixinta Koorsada</h1>

      <div className="card checkout-summary">
        <h3>{course.title}</h3>
        <div className="checkout-price-block">
          <span className="checkout-price-label">Lacagta</span>
          <div className="checkout-price">{formatPrice(course.price, course.currency)}</div>
        </div>
      </div>

      {paying ? (
        <div className="card checkout-waiting">
          <Spinner label="La sugayo xaqiijinta lacag bixinta…" />
          <p>
            <strong>Fiiri taleefankaaga.</strong> Ansixi codsiga lacag bixinta si aad u
            furto koorsada. Waxay qaadan kartaa ilaa laba daqiiqo — fadlan bogga ha ka
            bixin.
          </p>
        </div>
      ) : (
        <form className="card form-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          {payError && <div className="error-box">{payError}</div>}

          {!isFree && (
            <>
              <fieldset className="channel-picker">
                <legend>Ku bixi</legend>
                <div className="channel-options">
                  {PAYMENT_CHANNELS.map((c) => (
                    <label key={c.value} className="radio-card">
                      <input
                        type="radio"
                        value={c.value}
                        {...register("payment_channel")}
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
                {errors.payment_channel && (
                  <span className="field-error">{errors.payment_channel.message}</span>
                )}
              </fieldset>

              <label>
                Lambarka {activeChannel.label}
                <input
                  type="tel"
                  placeholder={`tusaale: ${activeChannel.placeholder}`}
                  autoComplete="tel"
                  {...register("phone_number")}
                />
                {errors.phone_number && (
                  <span className="field-error">{errors.phone_number.message}</span>
                )}
              </label>
            </>
          )}

          {isFree && (
            <input type="hidden" value="000000000" {...register("phone_number")} />
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg">
            {isFree
              ? "Isku diiwaan geli bilaash"
              : `Bixi ${formatPrice(course.price, course.currency)}`}
          </button>
          <p className="muted">
            Lacag bixinta waxaa lagu xaqiijiyaa taleefankaaga. Koorsada waa la furayaa
            isla markiiba marka la ansixiyo.
          </p>
        </form>
      )}
    </div>
  );
}
